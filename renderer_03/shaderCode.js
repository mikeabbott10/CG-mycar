vertexShaderSource = function()
{
return `
    /*
    uniform variables contain read-only data shared from WebGL/OpenGL environment to a vertex shader or fragment shader.
    */
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uLeftHeadlightMatrix;
    uniform mat4 uRightHeadlightMatrix;
    uniform mat4 uShadowMapMatrix;

    /*
    attribute read-only variables containing data shared from WebGL/OpenGL environment to the vertex shader.
    */
    attribute vec3 aPosition;
    attribute vec2 aUVCoords;

    /*
    varying variables contain data shared from a vertex shader to a fragment shader.
    The variable must be written in the vertex shader and the read-only value in the fragment shader is 
    then interpolated from the vertices which make up the fragment.
    */
    varying vec4 vWorldPos;
    varying vec2 vUVCoords;

    varying vec4 vLeftHeadlightPosition;
    varying vec4 vRightHeadlightPosition;

    varying vec4 vShadowMapPosition;

    void main(void){
        // ogni vertice ha le coordinate texture. Ogni fragmento avrà le coordinate 
        // texture grazie all'interpolazione effettuata durante la rasterizzazione
        vUVCoords = vec2(aUVCoords.x, aUVCoords.y);

        vWorldPos = uModelMatrix * vec4(aPosition, 1.0);
        gl_Position = uProjectionMatrix * uViewMatrix * vWorldPos;

        // vertice visto dal punto di vista della luce
        // vLeftHeadlightPosition è il punto "di vista" della luce
        vLeftHeadlightPosition = (uLeftHeadlightMatrix * vWorldPos); // frame del faro sinistro nel mondo
        vRightHeadlightPosition = (uRightHeadlightMatrix * vWorldPos); // frame del faro destro nel mondo

        // shadow mapping luce solare (vShadowMapPosition è il punto "di vista" della luce)
        vShadowMapPosition = (uShadowMapMatrix * vWorldPos) * 0.5 + 0.5;
    }
`;

}

fragmentShaderSource = function()
{
    
return `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    struct material
    {
        //diffuse color
        bool solid_color;
        vec4 diffuseColor;
        sampler2D texture;

        //specular color
        vec4 specularColor;
        float specularGlossiness;

        //emissive color
        vec4 emissiveColor;

        //normal map
        bool has_normal_map;
        sampler2D normalMap;
    };

    struct sunLight
    {
        vec3 direction;
        vec4 color;
        float intensity;
    };

    struct pointLight
    {
        vec3 position;
        vec4 color;
        float intensity;
        float test;
    };

    struct spotLight
    {
        vec3 position;
        vec3 direction;
        vec4 color;
        float intensity;
        float openingAngle;
        float cutoffAngle;
        float strength;
    };

    varying vec4 vWorldPos;
    varying vec2 vUVCoords;

    uniform sampler2D uHeadlightTexture;
    varying vec4 vLeftHeadlightPosition;
    uniform sampler2D uLeftHeadlightShadowMapTexture;
    varying vec4 vRightHeadlightPosition;
    uniform sampler2D uRightHeadlightShadowMapTexture;

    uniform sampler2D uShadowMapTexture;
    varying vec4 vShadowMapPosition;

    const int pointLightCount = 0;
    const int spotLightCount = 12;

    uniform material uMaterial;
    uniform vec4 uAmbientColor;
    uniform sunLight uSunLight;
    uniform spotLight uSpotLights[spotLightCount];

    uniform vec3 uViewDirection;
    uniform mat4 uModelMatrix;


    /**
     * Calcola la normale della superficie relativa al fragment in spazio mondo 
    */
    vec3 computeNormal(material mat){
        if(mat.has_normal_map){
            // dFdx(pos) and dFdy(pos) are tangent to the surface -> their cross product is orthogonal to it
            vec3 x_axis = normalize(  dFdx(vWorldPos.xyz)  ); // tangent to the surface 
            vec3 z_axis = normalize(  dFdy(vWorldPos.xyz)  ); // tangent to the surface
            vec3 y_axis = normalize(  cross( x_axis, z_axis )  ); // ortogonale al piano x_axis, z_axis
            
            // x_axis e z_axis non ortogonali tra loro
            // li voglio ortogonali perchè voglio il frame (matrix) ortogonale
            z_axis = normalize(  cross( x_axis, y_axis )  ); // ortogonale al piano x_axis, y_axis

            mat3 matrix; // il frame ortogonale desiderato
            matrix[0] = x_axis;
            matrix[1] = y_axis;
            matrix[2] = z_axis;
            return matrix * ( texture2D(mat.normalMap, vUVCoords * 2.0).xyz * 2.0 - 1.0 ).xzy;
        }else{
            // dFdx(pos) and dFdy(pos) are tangent to the surface -> their cross product is orthogonal to it
            return normalize(  cross( dFdx(vWorldPos.xyz), dFdy(vWorldPos.xyz) )  );
        }
    }

    /**
     * Ottieni il colore dalla texture o no
     */
    vec4 getDiffuseColor(material mat){
        if( mat.solid_color )
            return mat.diffuseColor;
        else
            return texture2D(mat.texture, vUVCoords);
    }

    /**
     * Calcola componente diffusiva data luce (direzione, colore, intensità)
     * (Phong)
     */ 
    vec4 computeDiffuseColor(vec3 currNormal, vec3 lightDirection, vec4 lightColor, float lightIntensity, vec4 diffuseColor){
        float diffuseDot = dot( lightDirection, currNormal ); // cos(angolo tra direzione della luce e normale alla superficie)
        if(diffuseDot > 0.0)
            // superficie con normale currNormal non è in ombra rispetto al sole
            // Diffuse reflection term: formula a slide 54 lezione 10 (Lighting)
            return vec4( (diffuseColor.xyz * lightColor.xyz) * (lightIntensity * diffuseDot), 1.0 );
        else
            // superficie con normale currNormal è in ombra rispetto al sole
            return vec4(0.0, 0.0, 0.0, 1.0);
    }

    /**
     * Calcola componente specular data luce (direzione, colore, intensità)
     * (Blinn-Phong)
     */ 
    vec4 computeSpecularColor(vec3 currNormal, vec3 lightDirection, vec4 lightColor, float lightIntensity, vec4 specularColor){
        // introdotto a slide 67 lezione 10 (Lighting)
        vec3 halfwayVector = normalize( lightDirection + uViewDirection );
        float specularDot = dot( halfwayVector, currNormal );
        if(specularDot > 0.0){ // stiamo guardando la superficie da davanti
            specularDot = pow(  specularDot, uMaterial.specularGlossiness  ); // cos(alfa) ^n
            // Specular reflection term: formula a slide 68 lezione 10 (Lighting)
            return vec4( specularColor.xyz * lightColor.xyz * specularDot * lightIntensity, 1.0 );
        }
        else // stiamo guardando la superficie da dietro
            return vec4(0.0, 0.0, 0.0, 1.0);
    }

    /**
     * Calcola somma tra diffuse reflection e specular reflection (Phong)
     */ 
    vec4 computeLightColor(vec3 currNormal, vec3 lightDirection, vec4 lightColor, float lightIntensity, vec4 materialDiffuseColor, vec4 materialSpecularColor){
        vec4 diffuseColor = computeDiffuseColor(currNormal, lightDirection, lightColor, lightIntensity, materialDiffuseColor);
        vec4 specularColor = computeSpecularColor(currNormal, lightDirection, lightColor, lightIntensity, materialSpecularColor);
        return diffuseColor + specularColor;
    }

    // calcolo direzione vettore da position al frammento corrente
    vec3 computePointDirection(vec3 position){
        return normalize( position - vWorldPos.xyz );
    }

    // calcolo lunghezza vettore da position al frammento corrente
    float computePointDistance(vec3 position){
        return length( position - vWorldPos.xyz );
    }

    /**
     * Calcolo attenuazione in base alla distanza dal punto luce
     */ 
    vec4 computeAttenuatedColor(vec3 currNormal, vec3 lightDirection, vec4 lightColor, float lightIntensity,
                float lightDistance, vec4 materialDiffuseColor, vec4 materialSpecularColor){
        vec4 mLightColor = computeLightColor(currNormal, lightDirection, lightColor, lightIntensity, materialDiffuseColor, materialSpecularColor);

        float attenuation = min( 1.0 / (lightDistance * lightDistance), 1.0 );
        return mLightColor * attenuation;
    }

    /**
     * Calcolo colore frammento dovuto ad uno spotlight fissato
     */ 
    vec4 computeSpotColor(vec3 currNormal, vec3 lightPosition, vec3 spotDirection, vec4 lightColor, float lightIntensity,
                float spotOpeningAngle, float spotCutoffAngle, float spotStrength,
                vec4 materialDiffuseColor, vec4 materialSpecularColor){

        vec3 lightDirection = computePointDirection(lightPosition);
        float lightDistance = computePointDistance(lightPosition);
        vec4 attenuatedColor = computeAttenuatedColor(currNormal, lightDirection, lightColor, lightIntensity,
            lightDistance, materialDiffuseColor, materialSpecularColor);

        float angle = acos(  dot( -lightDirection, spotDirection )  );
        float attenuation = 0.0;
        if(angle < spotOpeningAngle)
            attenuation = 1.0;
        else if(angle < spotCutoffAngle)
            attenuation = 1.0 - pow( (angle - spotOpeningAngle) / (spotCutoffAngle - spotOpeningAngle), spotStrength );

        return attenuatedColor * attenuation;
    }

    vec4 computeHeadlightColor(vec2 headlightUV, float distance){
        if(  distance > 0.0 
                    && all(greaterThanEqual( headlightUV, vec2(0.1, 0.1) )) 
                    && all(lessThanEqual( headlightUV, vec2(0.9, 0.9) ))  ){
            // fragment si trova nel cono di luce del faro
            return texture2D(uHeadlightTexture, headlightUV);
        }
        else{
            return vec4(0.0, 0.0, 0.0, 0.0);
        }
    }

    //shadowmap functions
    /**
     * ACNE slide 26 lezione 17-18 Shadows
     */
    float isInLight(sampler2D shadowmap, float current_depth, vec2 shadowmap_uv, float bias){
        float shadowmap_z = texture2D(shadowmap, shadowmap_uv).r;  // distanza dalla luce al primo ostacolo
        if( current_depth - bias < shadowmap_z) // bias evita ACNE rilassando la disequazione
            return 1.0;
        else
            return 0.0;
    }

    
    /**
     * PCF slide 39 lezione 17-18 Shadows
     */
    float inLight(sampler2D shadowmap, float current_depth, vec2 shadowmap_uv, float bias){
        float inLight = isInLight( shadowmap, current_depth, shadowmap_uv, bias );

        float count = 1.0;
        for(float dy = -0.0001; dy <= 0.0001; dy += 0.00004){
            for(float dx = -0.0001; dx <= 0.0001; dx += 0.00004){
                inLight = inLight + isInLight( shadowmap, current_depth, shadowmap_uv + vec2(dx, dy), bias );
                count += 1.0;
            }
        }
        return inLight / count;
    }

    float scaleByDistance(float distance, float factor)
    {
        return factor / (distance * distance);
    }

    void main(void)                                
    {                             
        vec3 currNormal = computeNormal(uMaterial);
        vec4 currDiffuseColor = getDiffuseColor(uMaterial);
        vec4 ambientColor = vec4(uAmbientColor.xyz * currDiffuseColor.xyz, 1.0);
        vec4 emissiveColor = vec4(uMaterial.emissiveColor.xyz, 1.0);
        
        // 
        vec2 shadowMapUV = vShadowMapPosition.xy / vShadowMapPosition.w; // coordinate in shadowmap relativa al punto di vista del sole
        float shadowMapDepth = vShadowMapPosition.z / vShadowMapPosition.w; // profondità del frammento rispetto alla luce del sole
        vec4 lightColorSum =
            computeLightColor(currNormal, uSunLight.direction, uSunLight.color, uSunLight.intensity, currDiffuseColor, uMaterial.specularColor)
            * inLight(uShadowMapTexture, shadowMapDepth, shadowMapUV, 0.0001);

        for(int i = 0; i < spotLightCount; i++){
            lightColorSum = lightColorSum + computeSpotColor(currNormal,
                uSpotLights[i].position, uSpotLights[i].direction, uSpotLights[i].color, uSpotLights[i].intensity,
                uSpotLights[i].openingAngle, uSpotLights[i].cutoffAngle, uSpotLights[i].strength,
                currDiffuseColor, uMaterial.specularColor);
        }

        // fari macchina
        vec2 leftHeadlightUV = (vLeftHeadlightPosition.xy / vLeftHeadlightPosition.w) * 0.5 + 0.5; // coordinate in shadowmap relativa al punto di vista del faro sx
        float leftHeadlightDepth = (vLeftHeadlightPosition.z / vLeftHeadlightPosition.w) * 0.5 + 0.5; // profondità del frammento rispetto alla luce del faro sx
        vec4 leftHeadlightColor = clamp(
                computeHeadlightColor(leftHeadlightUV, vLeftHeadlightPosition.z) *
                isInLight(uLeftHeadlightShadowMapTexture, leftHeadlightDepth, leftHeadlightUV, 0.003) *
                scaleByDistance(vLeftHeadlightPosition.z, 500.0),
            0.0, 0.5);
            
        vec2 rightHeadlightUV = (vRightHeadlightPosition.xy / vRightHeadlightPosition.w) * 0.5 + 0.5;
        float rightHeadlightDepth = (vRightHeadlightPosition.z / vRightHeadlightPosition.w) * 0.5 + 0.5;
        vec4 rightHeadlightColor = clamp(
                computeHeadlightColor(rightHeadlightUV, vRightHeadlightPosition.z) *
                isInLight(uRightHeadlightShadowMapTexture, rightHeadlightDepth, rightHeadlightUV, 0.003) *
                scaleByDistance(vRightHeadlightPosition.z, 500.0),
            0.0, 0.5);
        vec4 headlightColor = leftHeadlightColor + rightHeadlightColor;
        
        vec4 outColor = clamp( ambientColor + lightColorSum + emissiveColor + currDiffuseColor * headlightColor * headlightColor.a, 0.0, 1.0 );
        gl_FragColor = outColor;
    }
`;

}