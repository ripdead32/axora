// ======================================================
// AXORA SIMPLE GAME v0.2
// Single File WebGL Game
// ======================================================


// ===============================
// SHADERS
// ===============================

const AXORA_VERTEX_SHADER = `

attribute vec3 aPosition;
attribute vec3 aColor;
attribute vec3 aNormal;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

varying vec3 vColor;
varying vec3 vLighting;


void main()
{

    gl_Position =
        uProjection *
        uView *
        uModel *
        vec4(aPosition,1.0);


    vColor = aColor;


    vec3 lightDirection =
        normalize(
            vec3(0.4,1.0,0.3)
        );


    float light =
        max(
            dot(aNormal,lightDirection),
            0.25
        );


    vLighting =
        vec3(light);

}

`;



const AXORA_FRAGMENT_SHADER = `

precision mediump float;


varying vec3 vColor;
varying vec3 vLighting;


void main()
{

    gl_FragColor =
        vec4(
            vColor * vLighting,
            1.0
        );

}

`;





// ===============================
// MATRIX MATH
// ===============================


function mat4Identity()
{

    return new Float32Array([

        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1

    ]);

}



function mat4Multiply(a,b)
{

    let out =
        new Float32Array(16);


    for(let row=0; row<4; row++)
    {

        for(let col=0; col<4; col++)
        {

            out[row*4+col] =

                a[row*4+0] * b[col+0] +
                a[row*4+1] * b[col+4] +
                a[row*4+2] * b[col+8] +
                a[row*4+3] * b[col+12];

        }

    }


    return out;

}




function mat4Translate(x,y,z)
{

    let m =
        mat4Identity();


    m[12]=x;
    m[13]=y;
    m[14]=z;


    return m;

}




function mat4Scale(x,y,z)
{

    let m =
        mat4Identity();


    m[0]=x;
    m[5]=y;
    m[10]=z;


    return m;

}




function mat4RotateY(angle)
{

    let c =
        Math.cos(angle);


    let s =
        Math.sin(angle);



    return new Float32Array([

        c,0,-s,0,

        0,1,0,0,

        s,0,c,0,

        0,0,0,1

    ]);

}




function mat4RotateX(angle)
{

    let c =
        Math.cos(angle);


    let s =
        Math.sin(angle);



    return new Float32Array([

        1,0,0,0,

        0,c,s,0,

        0,-s,c,0,

        0,0,0,1

    ]);

}




function mat4Perspective(
    fov,
    aspect,
    near,
    far
)
{

    let f =
        1 /
        Math.tan(
            fov/2
        );


    let nf =
        1 /
        (near-far);



    return new Float32Array([

        f/aspect,0,0,0,

        0,f,0,0,

        0,0,
        (far+near)*nf,
        -1,

        0,0,
        2*far*near*nf,
        0

    ]);

}




// ===============================
// CUBE MESH
// ===============================


const cubeVertices =
new Float32Array([

    -1,-1,1,
     1,-1,1,
     1,1,1,
    -1,1,1,


    -1,-1,-1,
    -1,1,-1,
     1,1,-1,
     1,-1,-1,


    -1,1,-1,
    -1,1,1,
     1,1,1,
     1,1,-1,


    -1,-1,-1,
     1,-1,-1,
     1,-1,1,
    -1,-1,1,


     1,-1,-1,
     1,1,-1,
     1,1,1,
     1,-1,1,


    -1,-1,-1,
    -1,-1,1,
    -1,1,1,
    -1,1,-1

]);



const cubeNormals =
new Float32Array([

0,0,1,
0,0,1,
0,0,1,
0,0,1,

0,0,-1,
0,0,-1,
0,0,-1,
0,0,-1,

0,1,0,
0,1,0,
0,1,0,
0,1,0,

0,-1,0,
0,-1,0,
0,-1,0,
0,-1,0,

1,0,0,
1,0,0,
1,0,0,
1,0,0,

-1,0,0,
-1,0,0,
-1,0,0,
-1,0,0

]);



const cubeIndices =
new Uint16Array([

0,1,2,
0,2,3,

4,5,6,
4,6,7,

8,9,10,
8,10,11,

12,13,14,
12,14,15,

16,17,18,
16,18,19,

20,21,22,
20,22,23

]);
// ======================================================
// SHADER + PROGRAM CREATION
// ======================================================


function createShader(gl,type,source)
{

    let shader =
        gl.createShader(type);


    gl.shaderSource(
        shader,
        source
    );


    gl.compileShader(shader);


    if(
        !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
        )
    )
    {

        console.error(
            gl.getShaderInfoLog(shader)
        );

    }


    return shader;

}





function createProgram(gl)
{

    let program =
        gl.createProgram();



    gl.attachShader(
        program,
        createShader(
            gl,
            gl.VERTEX_SHADER,
            AXORA_VERTEX_SHADER
        )
    );


    gl.attachShader(
        program,
        createShader(
            gl,
            gl.FRAGMENT_SHADER,
            AXORA_FRAGMENT_SHADER
        )
    );


    gl.linkProgram(program);



    if(
        !gl.getProgramParameter(
            program,
            gl.LINK_STATUS
        )
    )
    {

        console.error(
            gl.getProgramInfoLog(program)
        );

    }



    return program;

}





// ======================================================
// GAME OBJECT
// ======================================================


class AxoraObject
{

    constructor()
    {

        this.x=0;
        this.y=0;
        this.z=0;


        this.scaleX=1;
        this.scaleY=1;
        this.scaleZ=1;


        this.rotation=0;


        this.color=[
            1,
            1,
            1
        ];


        this.material=null;

    }

}





// ======================================================
// MATERIAL SYSTEM
// ======================================================


function createColorBuffer(
    gl,
    color
)
{

    let data=[];


    for(
        let i=0;
        i<24;
        i++
    )
    {

        data.push(
            color[0],
            color[1],
            color[2]
        );

    }



    let buffer =
        gl.createBuffer();



    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        buffer
    );



    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(data),
        gl.STATIC_DRAW
    );



    return buffer;

}







// ======================================================
// ENGINE START
// ======================================================


function initAxora()
{

const canvas =
    document.getElementById(
        "axoraCanvas"
    );


const gl =
    canvas.getContext(
        "webgl"
    );



if(!gl)
{

    alert(
        "WebGL not supported"
    );

    return;

}





function resize()
{

    canvas.width =
        window.innerWidth;


    canvas.height =
        window.innerHeight;



    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );

}



window.addEventListener(
    "resize",
    resize
);



resize();





// ======================================================
// PROGRAM
// ======================================================


const program =
    createProgram(gl);



gl.useProgram(program);





const locations =
{

    position:
        gl.getAttribLocation(
            program,
            "aPosition"
        ),


    normal:
        gl.getAttribLocation(
            program,
            "aNormal"
        ),


    color:
        gl.getAttribLocation(
            program,
            "aColor"
        ),



    projection:
        gl.getUniformLocation(
            program,
            "uProjection"
        ),


    view:
        gl.getUniformLocation(
            program,
            "uView"
        ),


    model:
        gl.getUniformLocation(
            program,
            "uModel"
        )

};






// ======================================================
// GPU BUFFERS
// ======================================================


const vertexBuffer =
    gl.createBuffer();


gl.bindBuffer(
    gl.ARRAY_BUFFER,
    vertexBuffer
);


gl.bufferData(
    gl.ARRAY_BUFFER,
    cubeVertices,
    gl.STATIC_DRAW
);





const normalBuffer =
    gl.createBuffer();


gl.bindBuffer(
    gl.ARRAY_BUFFER,
    normalBuffer
);


gl.bufferData(
    gl.ARRAY_BUFFER,
    cubeNormals,
    gl.STATIC_DRAW
);





const indexBuffer =
    gl.createBuffer();


gl.bindBuffer(
    gl.ELEMENT_ARRAY_BUFFER,
    indexBuffer
);


gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    cubeIndices,
    gl.STATIC_DRAW
);





// ======================================================
// MATERIALS
// ======================================================


const materials =
{

    gray:
        createColorBuffer(
            gl,
            [
                0.35,
                0.35,
                0.35
            ]
        ),



    blue:
        createColorBuffer(
            gl,
            [
                0.1,
                0.45,
                1
            ]
        ),



    yellow:
        createColorBuffer(
            gl,
            [
                1,
                0.8,
                0.1
            ]
        ),



    red:
        createColorBuffer(
            gl,
            [
                0.8,
                0.1,
                0.1
            ]
        ),



    white:
        createColorBuffer(
            gl,
            [
                0.9,
                0.9,
                0.9
            ]
        )

};





gl.enable(
    gl.DEPTH_TEST
);



gl.enable(
    gl.CULL_FACE
);





// ======================================================
// WORLD
// ======================================================


let world=[];



function addObject(obj)
{

    world.push(obj);

}






// ======================================================
// DRAW OBJECT
// ======================================================


function drawObject(
    obj
)
{


let model =
    mat4Multiply(

        mat4Translate(
            obj.x,
            obj.y,
            obj.z
        ),


        mat4Multiply(

            mat4RotateY(
                obj.rotation
            ),


            mat4Scale(
                obj.scaleX,
                obj.scaleY,
                obj.scaleZ
            )

        )

    );





gl.uniformMatrix4fv(
    locations.model,
    false,
    model
);





gl.bindBuffer(
    gl.ARRAY_BUFFER,
    vertexBuffer
);


gl.vertexAttribPointer(
    locations.position,
    3,
    gl.FLOAT,
    false,
    0,
    0
);


gl.enableVertexAttribArray(
    locations.position
);





gl.bindBuffer(
    gl.ARRAY_BUFFER,
    normalBuffer
);


gl.vertexAttribPointer(
    locations.normal,
    3,
    gl.FLOAT,
    false,
    0,
    0
);


gl.enableVertexAttribArray(
    locations.normal
);





gl.bindBuffer(
    gl.ARRAY_BUFFER,
    obj.material
);


gl.vertexAttribPointer(
    locations.color,
    3,
    gl.FLOAT,
    false,
    0,
    0
);


gl.enableVertexAttribArray(
    locations.color
);





gl.bindBuffer(
    gl.ELEMENT_ARRAY_BUFFER,
    indexBuffer
);



gl.drawElements(
    gl.TRIANGLES,
    36,
    gl.UNSIGNED_SHORT,
    0
);


}
// ======================================================
// WORLD CREATION
// ======================================================


// ===============================
// BASEPLATE
// ===============================


let baseplate =
    new AxoraObject();


baseplate.y=-1;


baseplate.scaleX=50;
baseplate.scaleY=0.5;
baseplate.scaleZ=50;


baseplate.material =
    materials.gray;


addObject(
    baseplate
);





// ===============================
// TEST PARTS
// ===============================


for(
    let i=-5;
    i<=5;
    i++
)
{

    let block =
        new AxoraObject();


    block.x =
        i*3;


    block.y=1;


    block.z=-6;


    block.scaleX=1;
    block.scaleY=1;
    block.scaleZ=1;


    block.material =
        materials.white;


    addObject(
        block
    );

}







// ======================================================
// GRID SYSTEM
// ======================================================


const gridLines=[];



function createGrid()
{

    for(
        let i=-50;
        i<=50;
        i+=5
    )
    {

        gridLines.push(
        {

            x1:i,
            z1:-50,

            x2:i,
            z2:50

        });



        gridLines.push(
        {

            x1:-50,
            z1:i,

            x2:50,
            z2:i

        });


    }

}





createGrid();







function drawGrid()
{

    let vertices=[];


    for(
        let line of gridLines
    )
    {

        vertices.push(

            line.x1,
            -0.48,
            line.z1,

            line.x2,
            -0.48,
            line.z2

        );

    }




    let buffer =
        gl.createBuffer();



    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        buffer
    );



    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW
    );





    let colors=[];


    for(
        let i=0;
        i<vertices.length/3;
        i++
    )
    {

        colors.push(
            0.15,
            0.15,
            0.15
        );

    }



    let colorBuffer =
        gl.createBuffer();



    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        colorBuffer
    );



    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(colors),
        gl.STATIC_DRAW
    );




    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        buffer
    );


    gl.vertexAttribPointer(
        locations.position,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );


    gl.enableVertexAttribArray(
        locations.position
    );



    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        colorBuffer
    );


    gl.vertexAttribPointer(
        locations.color,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );


    gl.enableVertexAttribArray(
        locations.color
    );



    gl.disableVertexAttribArray(
        locations.normal
    );



    gl.lineWidth(1);



    gl.drawArrays(
        gl.LINES,
        0,
        vertices.length/3
    );


}








// ======================================================
// PLAYER
// ======================================================


let player =
{

    x:0,
    y:2,
    z:0,


    velocityY:0,


    speed:0.18,


    jumpPower:0.35,


    grounded:false,


    animation:0

};





let keys={};




window.addEventListener(
    "keydown",
    e=>
    {

        keys[
            e.key.toLowerCase()
        ]=true;


    }
);




window.addEventListener(
    "keyup",
    e=>
    {

        keys[
            e.key.toLowerCase()
        ]=false;


    }
);








// ======================================================
// PLAYER MODEL
// ======================================================


function createPlayerPart(
    x,
    y,
    z,
    sx,
    sy,
    sz,
    material
)
{

    let part =
        new AxoraObject();


    part.x=x;
    part.y=y;
    part.z=z;


    part.scaleX=sx;
    part.scaleY=sy;
    part.scaleZ=sz;


    part.material=
        material;


    return part;

}





function drawPlayer()
{


let walk =
    Math.sin(
        player.animation
    )
    *
    0.4;





// body


let body =
createPlayerPart(

    player.x,
    player.y,
    player.z,

    0.6,
    1,
    0.4,

    materials.blue

);


drawObject(body);





// head


let head =
createPlayerPart(

    player.x,
    player.y+1.5,
    player.z,

    0.45,
    0.45,
    0.45,

    materials.yellow

);


drawObject(head);






// left leg


let leg1 =
createPlayerPart(

    player.x-0.25,
    player.y-1,
    player.z,

    0.18,
    0.6,
    0.18,

    materials.red

);


leg1.rotation =
    walk;


drawObject(leg1);






// right leg


let leg2 =
createPlayerPart(

    player.x+0.25,
    player.y-1,
    player.z,

    0.18,
    0.6,
    0.18,

    materials.red

);


leg2.rotation =
    -walk;


drawObject(leg2);



}
// ======================================================
// CAMERA SYSTEM
// ======================================================


let camera =
{

    yaw:0,

    pitch:-0.25,


    distance:10

};





let mouseLocked=false;



canvas.addEventListener(
    "click",
    ()=>
    {

        canvas.requestPointerLock();

    }
);





document.addEventListener(
    "pointerlockchange",
    ()=>
    {

        mouseLocked =
            document.pointerLockElement
            ===canvas;

    }
);






document.addEventListener(
    "mousemove",
    e=>
    {

        if(!mouseLocked)
            return;



        camera.yaw -=
            e.movementX *
            0.002;



        camera.pitch -=
            e.movementY *
            0.002;



        camera.pitch =
            Math.max(
                -1,
                Math.min(
                    0.4,
                    camera.pitch
                )
            );

    }
);







// ======================================================
// VIEW MATRIX
// ======================================================


function getViewMatrix()
{


let cos =
    Math.cos(
        camera.yaw
    );


let sin =
    Math.sin(
        camera.yaw
    );




let camX =
    player.x -
    sin *
    camera.distance;



let camZ =
    player.z -
    cos *
    camera.distance;



let camY =
    player.y+5;



return mat4Multiply(

    mat4RotateY(
        -camera.yaw
    ),


    mat4Translate(
        -camX,
        -camY,
        -camZ
    )

);


}








// ======================================================
// PLAYER MOVEMENT
// ======================================================


function updatePlayer()
{


let forward=0;
let side=0;



if(keys["w"])
    forward+=1;


if(keys["s"])
    forward-=1;


if(keys["a"])
    side-=1;


if(keys["d"])
    side+=1;






let length =
Math.sqrt(
    forward*forward+
    side*side
);



if(length>0)
{

    forward/=length;
    side/=length;



    let sin =
        Math.sin(
            camera.yaw
        );


    let cos =
        Math.cos(
            camera.yaw
        );



    player.x +=
    (
        side*cos -
        forward*sin
    )
    *
    player.speed;



    player.z +=
    (
        forward*cos +
        side*sin
    )
    *
    player.speed;



    player.animation +=
        0.25;

}
else
{

    player.animation *=
        0.8;

}






// gravity


player.velocityY -=
    0.018;



player.y +=
    player.velocityY;






// floor collision


if(player.y<=2)
{

    player.y=2;


    player.velocityY=0;


    player.grounded=true;

}
else
{

    player.grounded=false;

}








}




// Jump


window.addEventListener(
    "keydown",
    e=>
    {

        if(
            e.code==="Space" &&
            player.grounded
        )
        {

            player.velocityY =
                player.jumpPower;

        }


    }
);









// ======================================================
// RENDER LOOP
// ======================================================


function gameLoop()
{


updatePlayer();





gl.clearColor(

    0.45,
    0.7,
    1,
    1

);




gl.clear(
    gl.COLOR_BUFFER_BIT |
    gl.DEPTH_BUFFER_BIT
);






let projection =
    mat4Perspective(

        Math.PI/3,


        canvas.width /
        canvas.height,


        0.1,


        500

    );





gl.uniformMatrix4fv(

    locations.projection,

    false,

    projection

);






let view =
    getViewMatrix();






gl.uniformMatrix4fv(

    locations.view,

    false,

    view

);







// Draw world


for(
    let obj of world
)
{

    drawObject(
        obj
    );

}





// Draw grid


drawGrid();




// Draw player


drawPlayer();







requestAnimationFrame(
    gameLoop
);


}





// START

gameLoop();

}
 


// ======================================================
// LAUNCH AXORA
// ======================================================


window.onload =
    initAxora;
