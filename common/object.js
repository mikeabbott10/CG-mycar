createObjectBuffers = function (gl, obj, texCoords)
{
    obj.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.vertices, gl.STATIC_DRAW); // riempi ARRAY_BUFFER con obj.vertices data
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
    if(obj.texCoords)
    {
        obj.uvcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.uvcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, obj.texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    else if(texCoords)
    {
        obj.uvcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.uvcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    else
        obj.uvcoordBuffer = null;
    
    obj.indexBufferTriangles = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles); // ELEMENT_ARRAY_BUFFER usato per indicare che indexBuffer contiene gli indici per ogni elemento di ARRAY_BUFFER
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.triangleIndices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  
    // create edges
    var edges = new Uint16Array(obj.numTriangles * 3 * 2);
    for (var i = 0; i < obj.numTriangles; ++i) {
        edges[i * 6 + 0] = obj.triangleIndices[i * 3 + 0];
        edges[i * 6 + 1] = obj.triangleIndices[i * 3 + 1];
        edges[i * 6 + 2] = obj.triangleIndices[i * 3 + 0];
        edges[i * 6 + 3] = obj.triangleIndices[i * 3 + 2];
        edges[i * 6 + 4] = obj.triangleIndices[i * 3 + 1];
        edges[i * 6 + 5] = obj.triangleIndices[i * 3 + 2];
    }
  
    obj.indexBufferEdges = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferEdges);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};


drawObject = function (obj, fillColor, gl, shader, use_color){
  if(use_color === undefined)
    use_color = true;

  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.enableVertexAttribArray(shader.aPositionIndex); // abilita shader.aPositionIndex come indice
  gl.vertexAttribPointer(shader.aPositionIndex, 3, gl.FLOAT, false, 0, 0);// informa WebGL come interpretare i dati: 
  /*
    gl.vertexAttribPointer(
        indice, 
        numero di valori per vertice,
        tipo dei dati/lo stesso tipo dell'array,
        normalizzare dati in un intervallo predefinito?,
        stride, // quanti bytes dall'inizio di un vertice al successivo
        offset // quanti bytes prima del primo vertice
    )
    Stride e offset possono essere usati per compattare più dati nello stesso array
    Per ogni vertice possiamo, ad esempio, avere anche attributi per il colore:

    20 bytes per vertice
    [pos0X, pos0Y, col0R, col0G, col0B, pos1X, pos1Y, col1R, col1G, col1B,…, posnX, posnY, colnR, colnG, colnB]
    ^               ^ offset colore
    offset posizione

    gl.vertexAttribPointer(positionAttribIndex, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(colorAttribIndex, 3, gl.FLOAT, false, 20, 8);
  */
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  if(obj.uvcoordBuffer)
  {
      gl.bindBuffer(gl.ARRAY_BUFFER, obj.uvcoordBuffer);
      gl.enableVertexAttribArray(shader.aUVCoordsIndex); // abilita shader.aUVCoordsIndex come indice
      gl.vertexAttribPointer(shader.aUVCoordsIndex, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
  if(use_color)
  {
      gl.uniform4fv(shader.uMaterialLocation.diffuseColor, fillColor);
  }
  gl.drawElements(gl.TRIANGLES, obj.triangleIndices.length, gl.UNSIGNED_SHORT, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.disableVertexAttribArray(shader.aPositionIndex);
  gl.disableVertexAttribArray(shader.aUVCoordsIndex);
};