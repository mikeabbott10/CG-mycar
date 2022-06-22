var Renderer = {};
var sun_i = 0;
var sunDir;

Renderer.loadLights = function(){
    var gl = Renderer.gl;
    var shader = Renderer.uniformShader;

    gl.useProgram(shader);

    // not static anymore
    //gl.uniform3fv(
    //    shader.uSunLocation.direction,
    //    glMatrix.vec3.normalize(glMatrix.vec3.create(), sunDir/*Game.scene.weather.sunLightDirection*/)
    //);
    
    gl.uniform1f(shader.uSunLocation.intensity, 1.0);

    for(var i = 0; i < Game.scene.lamps.length; i++){
        var lampPosition = glMatrix.vec3.clone(Game.scene.lamps[i].position);
        lampPosition[1] = lampPosition[1] + Game.scene.lamps[i].height -1;
        gl.uniform3fv(shader.uSpotLightLocation[i].position, lampPosition);
    }

    gl.useProgram(null);
}

Renderer.initializeObjects = function(){
    var gl = Renderer.gl;

    Game.setScene(scene_0);
    this.car = Game.addCar("mycar");
    Renderer.draw_car = makeCar();
    Renderer.draw_car.initialize(Renderer.gl);

    createObjectBuffers(gl, Game.scene.trackObj);
    createObjectBuffers(gl, Game.scene.groundObj);
    for (var i = 0; i < Game.scene.buildings.length; ++i){
        createObjectBuffers(gl, Game.scene.buildingsObjTex[i]);
        createObjectBuffers(gl, Game.scene.buildingsObjTex[i].roof);
    }
};

Renderer.startDrawScene = function (){
    var gl = Renderer.gl;
    var shader = Renderer.currentShader;
    var stack = Renderer.stack;

    var width = this.canvas.width;
    var height = this.canvas.height
    var ratio = width / height;

    gl.viewport(0, 0, width, height);

    //update cameras and build matrices
    let proj_matrix = glMatrix.mat4.perspective(glMatrix.mat4.create(),3.14 / 4, ratio, 1, 500);
    Renderer.cameras[Renderer.currentCamera].update(this.car.position, this.car.direction, this.car.frame);
    var invV = Renderer.cameras[Renderer.currentCamera].matrix(); // get user pov viewMatrix
    var view = Renderer.cameras[Renderer.currentCamera].view_direction(); // usato per il calcolo della componente speculare della luce

    // Clear the framebuffer
    gl.clearColor(0.34, 0.5, 0.74, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //draw cubemap
    gl.useProgram(Renderer.skyboxShader);
    gl.depthMask(false); // writing into the depth buffer is disabled
    gl.cullFace(gl.FRONT); // front faces non considerate

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, Renderer.skybox_texture);

    gl.uniformMatrix4fv(Renderer.skyboxShader.uProjectionMatrixLocation, false, proj_matrix);
    gl.uniformMatrix4fv(Renderer.skyboxShader.uViewMatrixLocation, false, invV);

    drawObject(Renderer.skyboxCube, [], Renderer.gl, Renderer.skyboxShader, false);

    gl.cullFace(gl.BACK); // back faces non considerate
    gl.useProgram(null);

    //start draw scene
    gl.depthMask(true); // writing into the depth buffer is enabled
    gl.useProgram(shader);

    gl.uniformMatrix4fv(shader.uProjectionMatrixLocation, false, proj_matrix);

    gl.uniform3fv(shader.uViewDirectionLocation, view);
    gl.uniformMatrix4fv(shader.uViewMatrixLocation, false, invV);
    
    // it's now dynamic.
    // update sun direction
    gl.uniform3fv(
        shader.uSunLocation.direction,
        glMatrix.vec3.normalize(glMatrix.vec3.create(), sunDir/*Game.scene.weather.sunLightDirection*/)
    );
    //console.log(glMatrix.vec3.dot(sunDir, [0,1,0]));
    // switch lamps on/off depending on angle between sun direction and ground normal ([0,1,0])
    let isLightEnough = glMatrix.vec3.dot(sunDir, [0,1,0]) > 0.2;
    for(var i = 0; i < Game.scene.lamps.length; i++){
        gl.uniform1f(Renderer.currentShader.uSpotLightLocation[i].intensity, isLightEnough? 0.0 : 10.0);
    }

    // load the car headlights matrices and textures
    Renderer.headlights["left"].update(this.car.position, this.car.direction, this.car.frame);
    Renderer.headlights["right"].update(this.car.position, this.car.direction, this.car.frame);

    gl.uniformMatrix4fv(shader.uLeftHeadlightMatrixLocation, false,
        glMatrix.mat4.mul(
        glMatrix.mat4.create(),
        Renderer.headlightProjectionMatrix,
        Renderer.headlights["left"].matrix()
        )
    );
    
    gl.uniformMatrix4fv(shader.uRightHeadlightMatrixLocation, false,
        glMatrix.mat4.mul(
        glMatrix.mat4.create(),
        Renderer.headlightProjectionMatrix,
        Renderer.headlights["right"].matrix()
        )
    );
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, Renderer.headlight_texture);
}

Renderer.drawScene = function (drawingSunShadowMap)
{
    var gl = Renderer.gl;
    var shader = Renderer.currentShader;
    var use_color = Renderer.useColor;
    var stack = Renderer.stack;

    // initialize the stack with the identity
    stack.loadIdentity();

    // drawing the car
    if(use_color){
        gl.uniform1i(shader.uMaterialLocation.is_solid_color, 1); // no texture
        gl.uniform4fv(shader.uMaterialLocation.specularColor, [ 1, 1, 1, 1 ]);
    }

    stack.push();

    stack.multiply(this.car.frame);
    gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, stack.matrix);
    Renderer.draw_car.draw(Renderer.car, gl, shader, stack, use_color);
    stack.pop();

    // drawing the static elements (ground, lamps ,track and buldings)
    if(use_color){
        gl.uniform1i(shader.uMaterialLocation.is_solid_color, 0); // si texture
        gl.uniform4fv(shader.uMaterialLocation.specularColor, [ 0, 0, 0, 1 ]);
    }

    // lamps
    for (var t in Game.scene.lamps) {
	    var stack_lamp = this.stack;
		stack_lamp.push();
		M_8 = glMatrix.mat4.create();
		glMatrix.mat4.fromTranslation(M_8, Game.scene.lamps[t].position);
		stack_lamp.multiply(M_8);
		stack_lamp.push();
		var M =  glMatrix.mat4.create();
	    glMatrix.mat4.fromTranslation(M, [0, 3, 0]);
		stack_lamp.multiply(M);
	
		var M1 = glMatrix.mat4.create();
	    glMatrix.mat4.fromScaling(M1, [1, 0.1, 1]);
		stack_lamp.multiply(M1);
	
		gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, stack_lamp.matrix);
		//gl.uniformMatrix4fv(shader.uProjectionMatrixLocation, false, this.projectionMatrix);
        testa = new Cube();
        createObjectBuffers(gl, testa);
        drawObject(testa, [0.6, 0.23, 0.12, 1.0], gl, shader, false);
		stack_lamp.pop();
	
		stack_lamp.push();
		var M_1_sca = glMatrix.mat4.create();
	    glMatrix.mat4.fromScaling(M_1_sca,[0.05, 1.5, 0.05]);
		stack_lamp.multiply(M_1_sca);

		gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, stack_lamp.matrix);
		//gl.uniformMatrix4fv(shader.uProjectionMatrixLocation, false, this.projectionMatrix);
        palo = new Cylinder(16);
        createObjectBuffers(gl, palo);
		drawObject(palo, [0.6, 0.23, 0.12, 1.0], gl, shader, false);
		stack_lamp.pop();
		stack_lamp.pop();
	}
    gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, this.stack.matrix);

    // ground
    if(use_color){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Renderer.grass_tile_texture);
    }
    if(drawingSunShadowMap)
        gl.cullFace(gl.FRONT);
    drawObject(Game.scene.groundObj, [0.3, 0.7, 0.2, 1.0], gl, shader, use_color);
    if(drawingSunShadowMap)
        gl.cullFace(gl.BACK);

    // track
    if(use_color){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Renderer.ground_texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, Renderer.ground_texture_normal);
        gl.uniform1i(shader.uMaterialLocation.has_normal_map, 1);
    }
    drawObject(Game.scene.trackObj, [0.9, 0.8, 0.7, 1.0], gl, shader, use_color);

    // buildings
    if(use_color){
        gl.uniform1i(shader.uMaterialLocation.has_normal_map, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Renderer.facade2_texture);
    }
    for (var i in Game.scene.buildingsObjTex){
        drawObject(Game.scene.buildingsObjTex[i], [0.8, 0.8, 0.8, 1.0], gl, shader, use_color);
    }

    // building roofs
    if(use_color){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Renderer.roof_texture);
    }
    for (var i in Game.scene.buildingsObjTex){
        drawObject(Game.scene.buildingsObjTex[i].roof, [0.8, 0.8, 0.8, 1.0], gl, shader, use_color);
    }
};

Renderer.endDrawScene = function(){
    var gl = Renderer.gl;
	gl.useProgram(null);
}

Renderer.drawShadowmaps = function(){
    var gl = Renderer.gl;
    var width = Renderer.canvas.width;
    var height = Renderer.canvas.height
    var ratio = width / height;

    // draw scene on framebuffer
    Renderer.currentShader = Renderer.shadowMapShader;
    Renderer.useColor = false;
  
    gl.useProgram(Renderer.shadowMapShader);
    
    // frame vista: da coordinate vista a coordinate mondo
    // inv frame di vista: da coordinate mondo a coordinate vista

    // Renderer.shadowMapViewMatrix è la matrice di vista dal "punto" di vista del sole
    // ruota luce sole intorno all'asse X
    sunDir = glMatrix.vec3.rotateX(
        glMatrix.vec3.create(), 
        sunDir, // cumula la rotazione
        [0,0,0],
        3.14/1500);
    //console.log(sunDir);
    // nuova viewMatrix data la nuova sun direction
    Renderer.shadowMapViewMatrix = glMatrix.mat4.lookAt( // restituisce inv frame di vista
        glMatrix.mat4.create(),
        // riscalo direzione luce per allontanare il "punto" luce dal centro del mondo
        glMatrix.vec3.scale(glMatrix.vec3.create(), sunDir, 100),
        [0, 0, 0], // view direction
        [0, 1, 0] // up vector
    );

    // shadowMap relativa al sole
    gl.bindFramebuffer(gl.FRAMEBUFFER, Renderer.shadowMapFramebuffer);
    gl.clear(gl.DEPTH_BUFFER_BIT); // clears buffers to preset values.
    gl.viewport(0, 0, Renderer.shadowMapResolution[0], Renderer.shadowMapResolution[1]);
    gl.uniformMatrix4fv(Renderer.shadowMapShader.uMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.shadowMapProjectionMatrix,
            Renderer.shadowMapViewMatrix
        )
    );
    Renderer.drawScene(true);

    // shadowMap relativa al faro sinistro
    gl.bindFramebuffer(gl.FRAMEBUFFER, Renderer.leftHeadlightShadowMapFramebuffer);
    gl.clear(gl.DEPTH_BUFFER_BIT); // clears buffers to preset values
    gl.viewport(0, 0, Renderer.headlightShadowMapResolution[0], Renderer.headlightShadowMapResolution[1]);
    gl.uniformMatrix4fv(Renderer.shadowMapShader.uMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.headlightProjectionMatrix,
            Renderer.headlights["left"].matrix()
        )
    );
    Renderer.drawScene();
  
    // shadowMap relativa al faro destro
    gl.bindFramebuffer(gl.FRAMEBUFFER, Renderer.rightHeadlightShadowMapFramebuffer);
    gl.clear(gl.DEPTH_BUFFER_BIT); // clears buffers to preset values.
    gl.viewport(0, 0, Renderer.headlightShadowMapResolution[0], Renderer.headlightShadowMapResolution[1]);
    gl.uniformMatrix4fv(Renderer.shadowMapShader.uMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.headlightProjectionMatrix,
            Renderer.headlights["right"].matrix()
        )
    );
    Renderer.drawScene();
  
    gl.useProgram(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

/**
 * Relative camera update
 */
Renderer.update = function(){
    /* reset camera */
    if(Renderer.currentCamera == "Relative"){
        if(Renderer.keys["r"])
            Renderer.cameras["Relative"].reset_camera();

        /* move camera */
        {
            let speed = 0.5;
            let current_offset = [0, 0, 0];
            if(Renderer.keys["w"])
                current_offset[2] -= speed;
            if(Renderer.keys["s"])
                current_offset[2] += speed;
            if(Renderer.keys["a"])
                current_offset[0] -= speed;
            if(Renderer.keys["d"])
                current_offset[0] += speed;
            
            // go up and down
            if(Renderer.keys["q"])
                current_offset[1] += speed;
            if(Renderer.keys["e"])
                current_offset[1] -= speed;

            Renderer.cameras["Relative"].add_offset(current_offset);
        }
    }    
}

Renderer.display = function(){
    var gl = Renderer.gl;
    var width = Renderer.canvas.width;
    var height = Renderer.canvas.height;
    var ratio = width / height;

    Renderer.update(); // update pov
    Renderer.drawShadowmaps(); // up

    // draw scene with uniform shader
    Renderer.currentShader = Renderer.uniformShader;
    Renderer.useColor = true;
    Renderer.startDrawScene();



    // sun
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, Renderer.shadowMapFramebuffer.depth_texture); // texture ha info su distanza dagli ostacoli
    gl.uniformMatrix4fv(Renderer.uniformShader.uShadowMapMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.shadowMapProjectionMatrix,
            Renderer.shadowMapViewMatrix
        )
    );

    // faro sx
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, Renderer.leftHeadlightShadowMapFramebuffer.depth_texture);
    gl.uniformMatrix4fv(Renderer.uniformShader.uLeftHeadlightMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.headlightProjectionMatrix,
            Renderer.headlights["left"].matrix()
        )
    );

    // faro dx
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, Renderer.rightHeadlightShadowMapFramebuffer.depth_texture);
    gl.uniformMatrix4fv(Renderer.uniformShader.uRightHeadlightMatrixLocation, false,
        glMatrix.mat4.mul(
            glMatrix.mat4.create(),
            Renderer.headlightProjectionMatrix,
            Renderer.headlights["right"].matrix()
        )
    );


    Renderer.drawScene();
    Renderer.endDrawScene();

    window.requestAnimationFrame(Renderer.display);
};


Renderer.setupAndStart = function (){
    /* create the canvas */
    Renderer.canvas = document.getElementById("OUTPUT-CANVAS");
    
    /* get the webgl context */
    var gl = Renderer.canvas.getContext("webgl");
    gl.getExtension('OES_standard_derivatives');
    gl.getExtension('WEBGL_depth_texture');
    Renderer.gl = gl;

    /* read the webgl version and log */
    var gl_version = gl.getParameter(gl.VERSION); 
    log("glversion: " + gl_version);
    var GLSL_version = gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    log("glsl  version: "+GLSL_version);

    /* setup webgl */
    // checks all the faces that are front facing towards the viewer 
    // and renders those while discarding all the faces that are back 
    // facing, saving us a lot of fragment shader calls
    gl.enable(gl.CULL_FACE);

    // prevent triangles rendering in the front while 
    // they're supposed to be behind other triangles
    gl.enable(gl.DEPTH_TEST);

    /* dictionary of cameras that will be used */
    Renderer.cameras = {};
    Renderer.cameras["FollowFromUp"] = new FollowFromUpCamera();
    Renderer.cameras["Chase"] = new ChaseCamera([0, 1.5, 0], [0, 4, 10]);
    Renderer.cameras["Relative"] = new ControllableChaseCamera([0, 1.5, 0], [0, 4, 10]);
    Renderer.currentCamera = "Relative";

    /* create the matrix stack */
    Renderer.stack = new MatrixStack();

    /* initialize objects to be rendered */
    Renderer.initializeObjects();

    sunDir = Game.scene.weather.sunLightDirection;

    /* create the shader */
    Renderer.uniformShader = new uniformShader(Renderer.gl);
    Renderer.currentShader = Renderer.uniformShader;
    Renderer.loadLights();

    /* create the skybox shader */
    Renderer.skyboxShader = new skyboxShader(Renderer.gl);
    Renderer.skyboxCube = new Cube();
    createObjectBuffers(Renderer.gl, Renderer.skyboxCube);

    /* setup headlights for the car and shadowmap framebuffers */
    Renderer.headlights = {};
    // glMatrix.mat4.perspective: generates a perspective projection matrix with the given bounds
    Renderer.headlightProjectionMatrix = glMatrix.mat4.perspective( glMatrix.mat4.create(), 0.35, /*ratio*/1, /*near*/1, /*far*/500 );
    Renderer.headlights["left"] = new ChaseCamera([-0.7, 0.35, -4], [-0.55, 0.45, -2]);
    Renderer.headlights["right"] = new ChaseCamera([0.7, 0.35, -4], [0.55, 0.45, -2]);

    Renderer.headlightShadowMapResolution = [2048, 2048];
    Renderer.leftHeadlightShadowMapFramebuffer = makeFramebuffer(Renderer.gl, Renderer.headlightShadowMapResolution);
    Renderer.rightHeadlightShadowMapFramebuffer = makeFramebuffer(Renderer.gl, Renderer.headlightShadowMapResolution);

    /* setup shadowmap shader and matrices */
    Renderer.shadowMapShader = new shadowMapShader(Renderer.gl);
    Renderer.shadowMapResolution = [4096, 4096];
    Renderer.shadowMapFramebuffer = makeFramebuffer(Renderer.gl, Renderer.shadowMapResolution);

    // ortogonale: raggi di luce paralleli
    // glMatrix.mat4.ortho: generates a orthogonal projection matrix with the given bounds
    Renderer.shadowMapProjectionMatrix = glMatrix.mat4.ortho(glMatrix.mat4.create(), /*left*/-150, /*right*/150, /*bottom*/-120, /*top*/120, 30, 350);

    /* load textures */
    Renderer.ground_texture        = load_texture(gl, "../common/textures/street5.png", 0); // campo 0 -> texture
    Renderer.ground_texture_normal = load_texture(gl, "../common/textures/asphalt_normal_map.jpg", 1); // campo 1 -> normali
    Renderer.facade1_texture       = load_texture(gl, "../common/textures/facade1.jpg", 0);
    Renderer.facade2_texture       = load_texture(gl, "../common/textures/facade2.jpg", 0);
    Renderer.facade3_texture       = load_texture(gl, "../common/textures/facade3.jpg", 0);
    Renderer.roof_texture          = load_texture(gl, "../common/textures/roof.jpg", 0);
    Renderer.grass_tile_texture    = load_texture(gl, "../common/textures/grass_tile.png", 0);
    Renderer.headlight_texture     = load_texture(gl, "../common/textures/headlight.png", 2, false);
    Renderer.skybox_texture        = make_cubemap(gl,
        "../common/textures/cubemap/posx.jpg",
        "../common/textures/cubemap/negx.jpg",
        "../common/textures/cubemap/negy.jpg",
        "../common/textures/cubemap/posy.jpg",
        "../common/textures/cubemap/posz.jpg",
        "../common/textures/cubemap/negz.jpg",
    2);

    /* add listeners for the mouse / keyboard events */
    Renderer.mouse = {};
    Renderer.keys = {};
    Renderer.canvas.addEventListener('mousedown', on_mouseDown, false);
    Renderer.canvas.addEventListener('mouseup', on_mouseUp, false);
    Renderer.canvas.addEventListener('mousemove', on_mouseMove, false);
    Renderer.canvas.addEventListener('keydown', on_keydown, false);
    Renderer.canvas.addEventListener('keyup', on_keyup, false);

    log("\n\n");
    log("Car Controls: Arrow Keys");
    log("Camera Controls (only Relative camera):\n  WASD (forward left back right)\n  QE (up down)\n  R (reset camera)");

    Renderer.display();
}

on_mouseUp = function(e){
    Renderer.mouse[e.button] = false;
}
  
on_mouseDown = function(e){
    Renderer.mouse[e.button] = true;
}

on_mouseMove = function(e){
    let scale = 0.1;
    if(Renderer.mouse[0] && Renderer.currentCamera == "Relative"){
        Renderer.cameras["Relative"].add_rotation(e.movementX * scale, e.movementY * scale);
    }
}

on_keyup = function(e){
	Renderer.keys[e.key] = false;
	Renderer.car.control_keys[e.key] = false;
}

on_keydown = function(e){
	Renderer.keys[e.key] = true;
	Renderer.car.control_keys[e.key] = true;
}

update_camera = function(camera_name){
    Renderer.currentCamera = camera_name;
}

window.onload = Renderer.setupAndStart;



