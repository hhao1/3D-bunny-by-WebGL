var canvas;
var gl;
var program;

// adjustable parameters
var near = 0.5;
var far = 100.0;
var fovy = 60.0;
var aspect = 1;

//shader location
var modelView, projection;
var pointLight, lightSpin;
var slAdjust, slSpin;

//model data buffer
var pointsArray = [];
var faceArray = [];
var vertNorm=[];
var indices=0;
var modelVert=0;

var ka = vec4(0.5, 0.4, 0.0, 1);
var kd = vec4(0.65, 0.52, 0.0, 1);
var ks = vec4(1.0, 0.98, 0.5, 1);
var shine0 = 36;
var shininess = shine0;

//matrices
var MVM, mvMatrix, pMatrix;

//transformation variables
var tStartXY=[0,0];
var rStartXY = [0,0];
var transforming = [false, false];
var lightRotate = true;

//point light
var plPosition = vec4(5,5,0,1);
var pla = vec4(0.25, 0.25, 0.25, 1);
var pld = vec4(0.75, 0.75, 0.75, 1);
var pls = vec4(1,1,1,1);

//spotlight
var slPosition = vec4(0, 4, 2, 1);
var slDirection;
var slCut = 30;
var attenuation = 1;
var theta = 0.0;
var lightSwing = true;
var angle=0;

//misc
var s=Math.sin(radians(1));
var c=Math.cos(radians(1));
var o=degrees(Math.atan(0.5));
var t = 0;
var modelLight = []; // vertex attribute, to tell if it's part of objects or lights

window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    aspect =  canvas.width/canvas.height;
    
    gl.clearColor( 0.3, 0.3, 0.3, 1.0 );
    gl.enable(gl.DEPTH_TEST);
    document.addEventListener('contextmenu', event => event.preventDefault());
    
    window.addEventListener("keydown", getKey, false);
    canvas.addEventListener("mousedown", function(event){
        var x = event.clientX;
        var y = event.clientY;
        if(event.button==0 && !transforming[1]){
            tStartXY = [x,y];
            transforming[0]=true;
        }else if(event.button==2 && !transforming[0]){//right click
            rStartXY = [x,y];
            transforming[1]=true;
        }
        
    });
    canvas.addEventListener("mousemove", function(event){
        var x = event.clientX;
        var y = event.clientY;
        if(transforming[0]){
            moveBunny(x, y);
        }else if (transforming[1]){
            rotateBunny(x,y);
        }
    });
    canvas.addEventListener("mouseup", function(event){
        mvMatrix = MVM;
        if(event.button==0){
            transforming[0]=false;
        }else if(event.button==2){
            transforming[1]=false;
        }
    });
    canvas.addEventListener("wheel",function(event){
        var delta;
        if (event.wheelDelta){
            delta = event.wheelDelta;
        }else{
            delta = -1 * event.deltaY;
        }
        if (delta < 0){
            zoom(-1);
        }else if (delta > 0){
            zoom(1);
        }
    })

    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    //
    //  load model
    //
    pointsArray = get_vertices();
    modelVert = pointsArray.length;
    for(i=0;i<modelVert; i++){
        vertNorm.push(vec4(0,0,0,0));
        vertNorm.matrix=false;
        modelLight.push(0.0);
    }

    faceArray = get_faces();
    indices = faceArray.length;
    for(i=0; i<faceArray.length; i++){
        for(j=0; j<faceArray[i].length; j++){
            faceArray[i][j]-=1;
        }
        edge1 = subtract(pointsArray[faceArray[i][0]], pointsArray[faceArray[i][1]]);
        edge2 = subtract(pointsArray[faceArray[i][1]], pointsArray[faceArray[i][2]]);
        fnorm = vec4(cross(edge1, edge2), 0.0);
        fnorm.matrix = false;
        for(j=0; j<faceArray[i].length; j++){
            vertNorm[faceArray[i][j]] = add(vertNorm[faceArray[i][j]], fnorm);
        }
    }

    for(i=0;i<vertNorm.length; i++){
        vertNorm[i][3] = 0.0;
        vertNorm[i] = normalize(vertNorm[i]);
    }

    gl.uniform4fv( gl.getUniformLocation(program,"Ka"), flatten(ka) );
    gl.uniform4fv( gl.getUniformLocation(program,"Kd"), flatten(kd) );
    gl.uniform4fv( gl.getUniformLocation(program,"Ks"), flatten(ks) );
    gl.uniform1f( gl.getUniformLocation(program,"shine"), shininess );

    //
    //  Initialize model-view and projection matrix
    //
    modelView = gl.getUniformLocation( program, "modelView" );
    projection = gl.getUniformLocation( program, "projection" );

    mvMatrix = mat4();
    MVM = mvMatrix;
    pMatrix = mult(perspective(fovy, aspect, near, far), lookAt(vec3(0,0,10), vec3(0,0,0), vec3(0,1,0)));
    gl.uniformMatrix4fv( projection, false, flatten(pMatrix) );

    //
    // initialize point light
    //
    gl.uniform4fv( gl.getUniformLocation(program,"plAmbient"),
                    flatten(pla) );
    gl.uniform4fv( gl.getUniformLocation(program,"plDiffuse"),
                    flatten(pld) );
    gl.uniform4fv( gl.getUniformLocation(program,"plSpecular"),
                    flatten(pls) );
    pointLight = gl.getUniformLocation(program, "pointLight");
    lightSpin = gl.getUniformLocation(program, "lightSpin");
    
    var l = 0.1
    var plVert = [
        vec3(-l,l,l), vec3(-l,-l,l), vec3(l,-l,l), vec3(l,l,l), //front
        vec3(-l,l,-l), vec3(-l,-l,-l), vec3(l,-l,-l), vec3(l,l,-l), //back
        vec3(-l,l,-l), vec3(-l,-l,-l), vec3(-l,-l,l), vec3(-l,l,l), //left
        vec3(l,-l,-l), vec3(l,l,-l), vec3(l,l,l), vec3(l,-l,l), //right
    ]
    
    for(i=0; i<plVert.length; i++){
        pointsArray.push(plVert[i]);
        modelLight.push(1.0);
        vertNorm.push(vec4(0,0,0,0));
    }

    //
    //initialize spotlight
    //
    gl.uniform4fv( gl.getUniformLocation(program, "spotLight"), flatten(slPosition));
    gl.uniform1f(gl.getUniformLocation(program, "slAngle"), slCut);
    gl.uniform1f(gl.getUniformLocation(program, "Attenuation"), attenuation);
    slAdjust = gl.getUniformLocation(program, "spotLightAdjust");
    slSpin = gl.getUniformLocation(program, "spotLightSpin");
    var sl = 0.3;
    var slh = sl*Math.cos(radians(30));
    var slvert = [
        vec3(sl/2*Math.cos(radians(0)), -slh, sl/2*Math.sin(radians(0))),
        vec3(sl/2*Math.cos(radians(60)), -slh, sl/2*Math.sin(radians(60))),
        vec3(sl/2*Math.cos(radians(120)), -slh, sl/2*Math.sin(radians(120))),
        vec3(sl/2*Math.cos(radians(180)), -slh, sl/2*Math.sin(radians(180))),
        vec3(sl/2*Math.cos(radians(240)), -slh, sl/2*Math.sin(radians(240))),
        vec3(sl/2*Math.cos(radians(300)), -slh, sl/2*Math.sin(radians(300))),

        vec3(sl/2*Math.cos(radians(0)), -slh, sl/2*Math.sin(radians(0))),
        vec3(sl/2*Math.cos(radians(60)), -slh, sl/2*Math.sin(radians(60))),
        vec3(0,0,0),

        vec3(sl/2*Math.cos(radians(120)), -slh, sl/2*Math.sin(radians(120))),
        vec3(sl/2*Math.cos(radians(180)), -slh, sl/2*Math.sin(radians(180))),
        vec3(0,0,0),

        vec3(sl/2*Math.cos(radians(240)), -slh, sl/2*Math.sin(radians(240))),
        vec3(sl/2*Math.cos(radians(300)), -slh, sl/2*Math.sin(radians(300))),
        vec3(0,0,0)
    ]
    for(i=0; i<slvert.length; i++){
        pointsArray.push(slvert[i]);
        modelLight.push(2.0);
        vertNorm.push(vec4(0,0,0,0));
    }

    //
    //  Load shaders and initialize attribute buffers
    //
    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertNorm), gl.STATIC_DRAW );
    
    var vNorm = gl.getAttribLocation( program, "vNorm" );
    gl.vertexAttribPointer( vNorm, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNorm );

    var bBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(modelLight), gl.STATIC_DRAW );
    
    var modelORLight = gl.getAttribLocation( program, "modelLight" );
    gl.vertexAttribPointer( modelORLight, 1, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( modelORLight );

    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW );
    
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(flatten(faceArray)), gl.STATIC_DRAW);

    render(); 
}

var render = function(){
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv( modelView, false, flatten(MVM) );

    if(lightRotate){
        plPosition = vec4(s * plPosition[2] + c * plPosition[0], 5, -s * plPosition[0] + c * plPosition[2], 1);
        gl.uniform4fv(pointLight, flatten(plPosition));
    }

    gl.uniformMatrix4fv(lightSpin, false, flatten(rotate(t, vec3(1,1,0.5))));
    
    if(lightSwing){
        updateSpotlight();
        theta = (theta+1.35)%360;
    }
    t = (t+1.1)%360;
    gl.uniformMatrix4fv(slSpin, false, flatten( rotate(t, vec3(0,1,0)) ));

    drawLight();
    gl.drawElements(gl.TRIANGLES, indices*3, gl.UNSIGNED_SHORT, 0);

    requestAnimFrame(render);
}

function updateSpotlight(){
    angle = 30* Math.sin(radians(theta));
    slDirection = mult( rotate(angle, vec3(0, 4, -8)) , rotate(o, vec3(1,0,0)));
    gl.uniformMatrix4fv(slAdjust, false, flatten(slDirection));
}

function getKey(key){
    //console.log(key.key);
    switch(key.key){
        case "ArrowUp":
            zoom(1);
            break;
        case "ArrowDown":
            zoom(-1);
            break;
        case "ArrowLeft":
            shininess--;
            gl.uniform1f( gl.getUniformLocation(program,"shine"), shininess );
            break;
        case "ArrowRight":
            shininess++;
            gl.uniform1f( gl.getUniformLocation(program,"shine"), shininess );
            break;
        case "r":
            mvMatrix = mat4();
            pMatrix = mult(perspective(fovy, aspect, near, far), lookAt(vec3(0,0,10), vec3(0,0,0), vec3(0,1,0)));
            MVM = mvMatrix;
            shininess = shine0;
            gl.uniform1f( gl.getUniformLocation(program,"shine"), shininess );
            break;
        case "p":
            lightRotate = !lightRotate;
            break;
        case "s":
            lightSwing = !lightSwing;
            break;
    }    
}

function zoom(co){
    if(transforming[0] || transforming[1]){
        return;
    }
    var TM = translate(0,0,co*0.5);
    mvMatrix = mult(TM, mvMatrix);
    MVM = mvMatrix;
}

function moveBunny(x,y){
    var dx = (x-tStartXY[0])/75;
    var dy = (tStartXY[1]-y)/75;
    var TM = translate(dx, dy, 0);
    MVM = mult(TM, mvMatrix);
}
function rotateBunny(x,y){
    var dy = (x-rStartXY[0])/5;
    var dx = (y-rStartXY[1])/5;
    var RM = mult(rotate(dx, vec3(1,0,0)), rotate(dy, vec3(0,1,0)));
    MVM = mult(RM, mvMatrix);
}

function drawLight(){
    //point light
    for(i=0; i<4; i++){
        gl.drawArrays(gl.LINE_LOOP, modelVert+4*i, 4);
    }
    //spotlight
    gl.drawArrays(gl.LINE_LOOP, modelVert+16, 6);
    gl.drawArrays(gl.LINE_LOOP, modelVert+22, 3);
    gl.drawArrays(gl.LINE_LOOP, modelVert+25, 3);
    gl.drawArrays(gl.LINE_LOOP, modelVert+28, 3);
}

function degrees(radian){
    return radian*180/Math.PI;
}