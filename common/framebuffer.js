makeFramebuffer = function(gl, size){
    var framebuffer = gl.createFramebuffer();

    framebuffer.depth_texture = make_empty_depth_texture(gl, size, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // specify a texture attachment
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, // target
        gl.DEPTH_ATTACHMENT, // attachment point <- cosa rimpiazzare dello screen buffer
        gl.TEXTURE_2D, // texture target
        framebuffer.depth_texture, // created texture
        0 // mip level
    );

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE){
        var str = "Unable to initialize the framebuffer.\n\n";
        if(status == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
            str += "Incomplete Attachment";
        else if(status == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT)
            str += "Incomplete Missing Attachment";
        alert(str);
    }
        

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // unbind
    return framebuffer;
}