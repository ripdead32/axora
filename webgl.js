/*
    Axora WebGL Engine
    Version 0.5
    Rip_Dead Engine
    Browser-based voxel-style engine

    Controls:
        WASD   = Move
        SPACE  = Jump
        Mouse  = Camera
        Wheel  = Zoom
        ESC    = Release mouse
*/

"use strict";

/* =========================================================
   ENGINE STATE
   ========================================================= */

let gl = null;
let canvas = null;
let shaderProgram = null;
let vertexBuffer = null;
let colorBuffer = null;
let axoraEngineStarted = false;
let lastTime = 0;
let deltaTime = 0;

/* =========================================================
   PLAYER
   ========================================================= */

const player = {
    x: 0,
    y: 1,
    z: 0,

    width: 0.65,
    depth: 0.65,
    height: 2.0,

    velocityY: 0,

    speed: 5,
    gravity: -22,
    jumpPower: 8,

    grounded: true,

    bobTime: 0,

    rotationY: 0
};

/* =========================================================
   CAMERA
   ========================================================= */

const camera = {
    x: 0,
    y: 3,
    z: 8,

    targetX: 0,
    targetY: 1.7,
    targetZ: 0,

    yaw: 0,
    pitch: -0.18,

    smoothness: 12
};

let cameraDistance = 8;

const CAMERA_MIN_DISTANCE = 4;
const CAMERA_MAX_DISTANCE = 16;

/* =========================================================
   INPUT
   ========================================================= */

const keys = {};

let mouseLocked = false;

const mouseSensitivity = 0.0025;

/* =========================================================
   MATH
   ========================================================= */

function lerp(a, b, amount) {
    return a + (b - a) * amount;
}

function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

/* =========================================================
   MATRIX MATH
   ========================================================= */

function multiplyMatrices(a, b) {

    const result =
        new Float32Array(16);

    for (let row = 0; row < 4; row++) {

        for (let column = 0; column < 4; column++) {

            result[
                column * 4 + row
            ] =
                a[0 * 4 + row] *
                b[column * 4 + 0]

                +

                a[1 * 4 + row] *
                b[column * 4 + 1]

                +

                a[2 * 4 + row] *
                b[column * 4 + 2]

                +

                a[3 * 4 + row] *
                b[column * 4 + 3];
        }
    }

    return result;
}

function getTranslationMatrix(
    x,
    y,
    z
) {

    return new Float32Array([

        1, 0, 0, 0,

        0, 1, 0, 0,

        0, 0, 1, 0,

        x, y, z, 1

    ]);
}

function getScaleMatrix(
    x,
    y,
    z
) {

    return new Float32Array([

        x, 0, 0, 0,

        0, y, 0, 0,

        0, 0, z, 0,

        0, 0, 0, 1

    ]);
}

function getRotationYMatrix(angle) {

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([

        c, 0, -s, 0,

        0, 1, 0, 0,

        s, 0, c, 0,

        0, 0, 0, 1

    ]);
}

function getPerspectiveMatrix(
    fieldOfView,
    aspect,
    near,
    far
) {

    const f =
        1 /
        Math.tan(fieldOfView / 2);

    const rangeInv =
        1 /
        (near - far);

    return new Float32Array([

        f / aspect,
        0,
        0,
        0,

        0,
        f,
        0,
        0,

        0,
        0,
        (near + far) * rangeInv,
        -1,

        0,
        0,
        near * far *
        rangeInv * 2,
        0

    ]);
}

/* =========================================================
   VECTOR MATH
   ========================================================= */

function normalizeVector(v) {

    const length =
        Math.sqrt(
            v[0] * v[0] +
            v[1] * v[1] +
            v[2] * v[2]
        );

    if (length === 0) {

        return [
            0,
            0,
            0
        ];
    }

    return [

        v[0] / length,
        v[1] / length,
        v[2] / length

    ];
}

function cross(a, b) {

    return [

        a[1] * b[2] -
        a[2] * b[1],

        a[2] * b[0] -
        a[0] * b[2],

        a[0] * b[1] -
        a[1] * b[0]

    ];
}

function dot(a, b) {

    return (

        a[0] * b[0] +
        a[1] * b[1] +
        a[2] * b[2]

    );
}

/* =========================================================
   LOOK AT
   ========================================================= */

function lookAt(
    eyeX,
    eyeY,
    eyeZ,
    targetX,
    targetY,
    targetZ
) {

    const forward =
        normalizeVector([

            targetX - eyeX,
            targetY - eyeY,
            targetZ - eyeZ

        ]);

    const worldUp = [
        0,
        1,
        0
    ];

    const right =
        normalizeVector(
            cross(
                forward,
                worldUp
            )
        );

    const up =
        cross(
            right,
            forward
        );

    return new Float32Array([

        right[0],
        up[0],
        -forward[0],
        0,

        right[1],
        up[1],
        -forward[1],
        0,

        right[2],
        up[2],
        -forward[2],
        0,

        -dot(
            right,
            [
                eyeX,
                eyeY,
                eyeZ
            ]
        ),

        -dot(
            up,
            [
                eyeX,
                eyeY,
                eyeZ
            ]
        ),

        dot(
            forward,
            [
                eyeX,
                eyeY,
                eyeZ
            ]
        ),

        1

    ]);
}

/* =========================================================
   SHADERS
   ========================================================= */

const vertexShaderSource = `

attribute vec3 aPosition;
attribute vec3 aColor;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

varying vec3 vColor;
varying float vDepth;

void main()
{

    vec4 worldPosition =
        uModel *
        vec4(aPosition, 1.0);

    vec4 viewPosition =
        uView *
        worldPosition;

    gl_Position =
        uProjection *
        viewPosition;

    vColor =
        aColor;

    vDepth =
        -viewPosition.z;
}

`;

const fragmentShaderSource = `

precision mediump float;

varying vec3 vColor;
varying float vDepth;

void main()
{

    vec3 fogColor =
        vec3(
            0.045,
            0.08,
            0.16
        );

    float fogAmount =
        clamp(
            vDepth / 115.0,
            0.0,
            1.0
        );

    vec3 finalColor =
        mix(
            vColor,
            fogColor,
            fogAmount
        );

    gl_FragColor =
        vec4(
            finalColor,
            1.0
        );
}

`;

/* =========================================================
   SHADER COMPILATION
   ========================================================= */

function compileShader(
    type,
    source
) {

    const shader =
        gl.createShader(type);

    gl.shaderSource(
        shader,
        source
    );

    gl.compileShader(
        shader
    );

    if (
        !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
        )
    ) {

        console.error(
            "Axora Engine: Shader compilation failed:"
        );

        console.error(
            gl.getShaderInfoLog(shader)
        );

        gl.deleteShader(
            shader
        );

        return null;
    }

    console.log(
        "Axora Engine: " +
        (
            type === gl.VERTEX_SHADER
                ? "Vertex"
                : "Fragment"
        ) +
        " Shader compiled successfully."
    );

    return shader;
}

function createShaderProgram() {

    const vertexShader =
        compileShader(
            gl.VERTEX_SHADER,
            vertexShaderSource
        );

    const fragmentShader =
        compileShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        );

    if (
        !vertexShader ||
        !fragmentShader
    ) {

        return null;
    }

    const program =
        gl.createProgram();

    gl.attachShader(
        program,
        vertexShader
    );

    gl.attachShader(
        program,
        fragmentShader
    );

    gl.linkProgram(
        program
    );

    if (
        !gl.getProgramParameter(
            program,
            gl.LINK_STATUS
        )
    ) {

        console.error(
            "Axora Engine: Shader program linking failed:"
        );

        console.error(
            gl.getProgramInfoLog(
                program
            )
        );

        return null;
    }

    console.log(
        "Axora Engine: Shader program linked."
    );

    return program;
}

/* =========================================================
   CUBE GEOMETRY
   ========================================================= */

const cubeVertices =
    new Float32Array([

        /* FRONT */

        -0.5, -0.5,  0.5,
         0.5, -0.5,  0.5,
         0.5,  0.5,  0.5,

        -0.5, -0.5,  0.5,
         0.5,  0.5,  0.5,
        -0.5,  0.5,  0.5,

        /* BACK */

         0.5, -0.5, -0.5,
        -0.5, -0.5, -0.5,
        -0.5,  0.5, -0.5,

         0.5, -0.5, -0.5,
        -0.5,  0.5, -0.5,
         0.5,  0.5, -0.5,

        /* LEFT */

        -0.5, -0.5, -0.5,
        -0.5, -0.5,  0.5,
        -0.5,  0.5,  0.5,

        -0.5, -0.5, -0.5,
        -0.5,  0.5,  0.5,
        -0.5,  0.5, -0.5,

        /* RIGHT */

         0.5, -0.5,  0.5,
         0.5, -0.5, -0.5,
         0.5,  0.5, -0.5,

         0.5, -0.5,  0.5,
         0.5,  0.5, -0.5,
         0.5,  0.5,  0.5,

        /* TOP */

        -0.5,  0.5,  0.5,
         0.5,  0.5,  0.5,
         0.5,  0.5, -0.5,

        -0.5,  0.5,  0.5,
         0.5,  0.5, -0.5,
        -0.5,  0.5, -0.5,

        /* BOTTOM */

        -0.5, -0.5, -0.5,
         0.5, -0.5, -0.5,
         0.5, -0.5,  0.5,

        -0.5, -0.5, -0.5,
         0.5, -0.5,  0.5,
        -0.5, -0.5,  0.5

    ]);

/* =========================================================
   COLORS
   ========================================================= */

const COLORS = {

    grass: [
        0.20,
        0.70,
        0.20
    ],

    grassDark: [
        0.12,
        0.48,
        0.13
    ],

    stone: [
        0.45,
        0.48,
        0.52
    ],

    dirt: [
        0.48,
        0.27,
        0.10
    ],

    red: [
        0.90,
        0.10,
        0.10
    ],

    blue: [
        0.10,
        0.35,
        0.95
    ],

    yellow: [
        1.00,
        0.75,
        0.05
    ],

    purple: [
        0.65,
        0.20,
        0.95
    ],

    trunk: [
        0.40,
        0.22,
        0.08
    ],

    leaves: [
        0.08,
        0.55,
        0.14
    ],

    playerBody: [
        0.20,
        0.45,
        0.95
    ],

    playerBodyDark: [
        0.12,
        0.28,
        0.70
    ],

    pants: [
        0.08,
        0.10,
        0.18
    ],

    shoes: [
        0.06,
        0.06,
        0.07
    ],

    skin: [
        1.00,
        0.70,
        0.45
    ],

    black: [
        0.015,
        0.015,
        0.02
    ],

    white: [
        1.00,
        1.00,
        1.00
    ]

};

/* =========================================================
   COLOR GENERATION
   ========================================================= */

function createCubeColors(color) {

    const output = [];

    for (
        let i = 0;
        i < 36;
        i++
    ) {

        let brightness = 1.0;

        /* FRONT */

        if (
            i >= 0 &&
            i < 6
        ) {

            brightness = 1.05;
        }

        /* LEFT */

        if (
            i >= 12 &&
            i < 18
        ) {

            brightness = 0.82;
        }

        /* RIGHT */

        if (
            i >= 18 &&
            i < 24
        ) {

            brightness = 0.92;
        }

        /* TOP */

        if (
            i >= 24 &&
            i < 30
        ) {

            brightness = 1.20;
        }

        /* BOTTOM */

        if (i >= 30) {

            brightness = 0.65;
        }

        output.push(

            Math.min(
                color[0] * brightness,
                1
            ),

            Math.min(
                color[1] * brightness,
                1
            ),

            Math.min(
                color[2] * brightness,
                1
            )

        );
    }

    return new Float32Array(
        output
    );
}

/* =========================================================
   WORLD
   ========================================================= */

const world = [];

function addBlock(
    x,
    y,
    z,
    color,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1
) {

    world.push({

        x,
        y,
        z,

        scaleX,
        scaleY,
        scaleZ,

        color

    });
}

/* =========================================================
   WORLD GENERATION
   ========================================================= */

function createWorld() {

    world.length = 0;

    /* GRASS FIELD */

    for (
        let x = -14;
        x <= 14;
        x++
    ) {

        for (
            let z = -14;
            z <= 14;
            z++
        ) {

            addBlock(
                x,
                -0.5,
                z,
                COLORS.grass
            );
        }
    }

    /* MAIN STONE ROAD */

    for (
        let z = -14;
        z <= 14;
        z++
    ) {

        addBlock(
            0,
            0.01,
            z,
            COLORS.stone
        );
    }

    for (
        let x = -14;
        x <= 14;
        x++
    ) {

        addBlock(
            x,
            0.01,
            0,
            COLORS.stone
        );
    }

    /* LANDMARKS */

    createLandmark(
        -7,
        -7,
        COLORS.red
    );

    createLandmark(
        7,
        -7,
        COLORS.blue
    );

    createLandmark(
        -7,
        7,
        COLORS.yellow
    );

    createLandmark(
        7,
        7,
        COLORS.purple
    );

    /* BUILDING */

    for (
        let x = -3;
        x <= 3;
        x++
    ) {

        for (
            let z = -6;
            z <= -3;
            z++
        ) {

            addBlock(
                x,
                0.5,
                z,
                COLORS.dirt
            );
        }
    }

    /* TREES */

    createTree(
        -10,
        -2
    );

    createTree(
        10,
        -2
    );

    createTree(
        -10,
        10
    );

    createTree(
        10,
        10
    );
}

/* =========================================================
   LANDMARK
   ========================================================= */

function createLandmark(
    x,
    z,
    color
) {

    addBlock(
        x,
        0.5,
        z,
        color,
        2,
        1,
        2
    );

    for (
        let y = 1.5;
        y <= 4.5;
        y++
    ) {

        addBlock(
            x,
            y,
            z,
            color
        );
    }

    addBlock(
        x,
        5.5,
        z,
        color,
        1.5,
        1,
        1.5
    );
}

/* =========================================================
   TREE
   ========================================================= */

function createTree(
    x,
    z
) {

    addBlock(
        x,
        0.5,
        z,
        COLORS.trunk,
        1,
        2,
        1
    );

    addBlock(
        x,
        1.5,
        z,
        COLORS.trunk
    );

    addBlock(
        x,
        2.5,
        z,
        COLORS.leaves,
        3,
        1,
        3
    );

    addBlock(
        x,
        3.5,
        z,
        COLORS.leaves,
        2,
        1,
        2
    );

    addBlock(
        x,
        4.5,
        z,
        COLORS.leaves
    );
}

/* =========================================================
   BLOCK COLLISION
   ========================================================= */

function getPlayerBounds(
    x = player.x,
    y = player.y,
    z = player.z
) {

    return {

        minX:
            x -
            player.width / 2,

        maxX:
            x +
            player.width / 2,

        minY:
            y,

        maxY:
            y +
            player.height,

        minZ:
            z -
            player.depth / 2,

        maxZ:
            z +
            player.depth / 2

    };
}

function getBlockBounds(block) {

    return {

        minX:
            block.x -
            block.scaleX / 2,

        maxX:
            block.x +
            block.scaleX / 2,

        minY:
            block.y -
            block.scaleY / 2,

        maxY:
            block.y +
            block.scaleY / 2,

        minZ:
            block.z -
            block.scaleZ / 2,

        maxZ:
            block.z +
            block.scaleZ / 2

    };
}

function boxesIntersect(a, b) {

    return (

        a.maxX > b.minX &&
        a.minX < b.maxX &&

        a.maxY > b.minY &&
        a.minY < b.maxY &&

        a.maxZ > b.minZ &&
        a.minZ < b.maxZ

    );
}

/* =========================================================
   COLLISION CHECK
   ========================================================= */

function playerCollidesAt(
    x,
    y,
    z
) {

    const playerBounds =
        getPlayerBounds(
            x,
            y,
            z
        );

    for (
        const block of world
    ) {

        const blockBounds =
            getBlockBounds(
                block
            );

        if (
            boxesIntersect(
                playerBounds,
                blockBounds
            )
        ) {

            return true;
        }
    }

    return false;
}

/* =========================================================
   HORIZONTAL MOVEMENT
   ========================================================= */

function movePlayerHorizontal(
    moveX,
    moveZ
) {

    const oldX =
        player.x;

    const oldZ =
        player.z;

    /* X */

    player.x += moveX;

    if (
        playerCollidesAt(
            player.x,
            player.y,
            player.z
        )
    ) {

        player.x =
            oldX;
    }

    /* Z */

    player.z += moveZ;

    if (
        playerCollidesAt(
            player.x,
            player.y,
            player.z
        )
    ) {

        player.z =
            oldZ;
    }
}

/* =========================================================
   VERTICAL COLLISION
   ========================================================= */

function resolveVerticalCollision(
    oldY
) {

    const bounds =
        getPlayerBounds();

    for (
        const block of world
    ) {

        const blockBounds =
            getBlockBounds(
                block
            );

        if (

            bounds.maxX <= blockBounds.minX ||

            bounds.minX >= blockBounds.maxX ||

            bounds.maxZ <= blockBounds.minZ ||

            bounds.minZ >= blockBounds.maxZ

        ) {

            continue;
        }

        /* FALLING */

        if (

            player.velocityY <= 0 &&

            oldY >= blockBounds.maxY &&

            player.y <= blockBounds.maxY

        ) {

            player.y =
                blockBounds.maxY;

            player.velocityY =
                0;

            player.grounded =
                true;

            return;
        }

        /* JUMPING */

        if (

            player.velocityY > 0 &&

            oldY + player.height <=
                blockBounds.minY &&

            player.y + player.height >=
                blockBounds.minY

        ) {

            player.y =
                blockBounds.minY -
                player.height;

            player.velocityY =
                0;

            return;
        }
    }
}

/* =========================================================
   PLAYER UPDATE
   ========================================================= */

function updatePlayer() {

    let moveX = 0;
    let moveZ = 0;

    /* INPUT */

    if (keys["KeyW"]) {
        moveZ += 1;
    }

    if (keys["KeyS"]) {
        moveZ -= 1;
    }

    if (keys["KeyA"]) {
        moveX -= 1;
    }

    if (keys["KeyD"]) {
        moveX += 1;
    }

    const inputLength =
        Math.sqrt(
            moveX * moveX +
            moveZ * moveZ
        );

    let moving = false;

    if (inputLength > 0) {

        moveX /=
            inputLength;

        moveZ /=
            inputLength;

        moving = true;
    }

    /* CAMERA RELATIVE MOVEMENT */

    if (moving) {

        const sinYaw =
            Math.sin(
                camera.yaw
            );

        const cosYaw =
            Math.cos(
                camera.yaw
            );

        /*
            Correct movement directions.

            W = forward
            S = backward
            A = left
            D = right
        */

        const forwardX =
            sinYaw;

        const forwardZ =
            cosYaw;

        const rightX =
            -cosYaw;

        const rightZ =
            sinYaw;

        const worldMoveX =
            forwardX * moveZ +
            rightX * moveX;

        const worldMoveZ =
            forwardZ * moveZ +
            rightZ * moveX;

        const horizontalMoveX =
            worldMoveX *
            player.speed *
            deltaTime;

        const horizontalMoveZ =
            worldMoveZ *
            player.speed *
            deltaTime;

        movePlayerHorizontal(
            horizontalMoveX,
            horizontalMoveZ
        );

        /* PLAYER ROTATION */

        player.rotationY =
            Math.atan2(
                worldMoveX,
                worldMoveZ
            );

        /* WALKING ANIMATION */

        if (player.grounded) {

            player.bobTime +=
                deltaTime * 11;
        }
    }

    /* JUMP */

    if (
        keys["Space"] &&
        player.grounded
    ) {

        player.velocityY =
            player.jumpPower;

        player.grounded =
            false;
    }

    /* GRAVITY */

    const oldY =
        player.y;

    player.velocityY +=
        player.gravity *
        deltaTime;

    player.y +=
        player.velocityY *
        deltaTime;

    player.grounded =
        false;

    /* VERTICAL COLLISION */

    resolveVerticalCollision(
        oldY
    );

    /* WORLD BOUNDARIES */

    player.x =
        clamp(
            player.x,
            -13.2,
            13.2
        );

    player.z =
        clamp(
            player.z,
            -13.2,
            13.2
        );

    /* EMERGENCY RESET */

    if (
        player.y < -20
    ) {

        player.x = 0;
        player.y = 1;
        player.z = 0;

        player.velocityY = 0;

        player.grounded =
            true;
    }
}

/* =========================================================
   CAMERA COLLISION
   ========================================================= */

function isCameraPositionBlocked(
    x,
    y,
    z
) {

    const radius = 0.25;

    const cameraBounds = {

        minX:
            x - radius,

        maxX:
            x + radius,

        minY:
            y - radius,

        maxY:
            y + radius,

        minZ:
            z - radius,

        maxZ:
            z + radius

    };

    for (
        const block of world
    ) {

        const bounds =
            getBlockBounds(
                block
            );

        if (
            boxesIntersect(
                cameraBounds,
                bounds
            )
        ) {

            return true;
        }
    }

    return false;
}

function resolveCameraCollision(
    desiredX,
    desiredY,
    desiredZ
) {

    const target = {

        x: player.x,

        y:
            player.y + 1.1,

        z: player.z

    };

    const steps = 40;

    let lastSafe = {

        x: target.x,
        y: target.y,
        z: target.z

    };

    for (
        let i = 1;
        i <= steps;
        i++
    ) {

        const amount =
            i / steps;

        const testX =
            lerp(
                target.x,
                desiredX,
                amount
            );

        const testY =
            lerp(
                target.y,
                desiredY,
                amount
            );

        const testZ =
            lerp(
                target.z,
                desiredZ,
                amount
            );

        if (
            isCameraPositionBlocked(
                testX,
                testY,
                testZ
            )
        ) {

            return lastSafe;
        }

        lastSafe = {

            x: testX,
            y: testY,
            z: testZ

        };
    }

    return lastSafe;
}

/* =========================================================
   CAMERA UPDATE
   ========================================================= */

function updateCamera() {

    camera.targetX =
        player.x;

    camera.targetY =
        player.y + 1.15;

    camera.targetZ =
        player.z;

    const horizontalDistance =
        Math.cos(
            camera.pitch
        ) *
        cameraDistance;

    const verticalDistance =
        Math.sin(
            camera.pitch
        ) *
        cameraDistance;

    const desiredX =
        player.x -
        Math.sin(
            camera.yaw
        ) *
        horizontalDistance;

    const desiredY =
        player.y +
        1.5 +
        verticalDistance;

    const desiredZ =
        player.z -
        Math.cos(
            camera.yaw
        ) *
        horizontalDistance;

    const safePosition =
        resolveCameraCollision(
            desiredX,
            desiredY,
            desiredZ
        );

    const smoothing =
        1 -
        Math.exp(
            -camera.smoothness *
            deltaTime
        );

    camera.x =
        lerp(
            camera.x,
            safePosition.x,
            smoothing
        );

    camera.y =
        lerp(
            camera.y,
            safePosition.y,
            smoothing
        );

    camera.z =
        lerp(
            camera.z,
            safePosition.z,
            smoothing
        );
}

/* =========================================================
   DRAW CUBE
   ========================================================= */

function drawCube(
    x,
    y,
    z,
    scaleX,
    scaleY,
    scaleZ,
    color,
    rotationY = 0
) {

    let model =
        getTranslationMatrix(
            x,
            y,
            z
        );

    if (
        rotationY !== 0
    ) {

        model =
            multiplyMatrices(
                model,
                getRotationYMatrix(
                    rotationY
                )
            );
    }

    model =
        multiplyMatrices(
            model,
            getScaleMatrix(
                scaleX,
                scaleY,
                scaleZ
            )
        );

    gl.uniformMatrix4fv(
        shaderProgram.modelLocation,
        false,
        model
    );

    const colors =
        createCubeColors(
            color
        );

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        colorBuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        colors,
        gl.DYNAMIC_DRAW
    );

    gl.vertexAttribPointer(
        shaderProgram.colorLocation,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.drawArrays(
        gl.TRIANGLES,
        0,
        36
    );
}

/* =========================================================
   PLAYER DRAWING
   ========================================================= */

function drawPlayer() {

    const moving =
        keys["KeyW"] ||
        keys["KeyA"] ||
        keys["KeyS"] ||
        keys["KeyD"];

    /* BODY BOB */

    let bob = 0;

    if (
        moving &&
        player.grounded
    ) {

        bob =
            Math.sin(
                player.bobTime * 2
            ) *
            0.045;
    }

    /*
        IMPORTANT:

        The legs are positioned using
        the player's RIGHT vector.

        This means they stay properly
        separated when the character
        rotates.
    */

    let leftLegOffset = 0;
    let rightLegOffset = 0;

    if (
        moving &&
        player.grounded
    ) {

        const legWave =
            Math.sin(
                player.bobTime
            );

        leftLegOffset =
            legWave * 0.08;

        rightLegOffset =
            -legWave * 0.08;
    }

    /* PLAYER BASIS */

    const sinRotation =
        Math.sin(
            player.rotationY
        );

    const cosRotation =
        Math.cos(
            player.rotationY
        );

    /*
        Right direction of player.

        At rotation 0:
            right = +X
    */

    const rightX =
        cosRotation;

    const rightZ =
        -sinRotation;

    /* =====================================================
       BODY
       ===================================================== */

    drawCube(

        player.x,

        player.y +
        1.05 +
        bob,

        player.z,

        0.82,
        0.95,
        0.58,

        COLORS.playerBody,

        player.rotationY
    );

    /* =====================================================
       HEAD
       ===================================================== */

    drawCube(

        player.x,

        player.y +
        1.82 +
        bob,

        player.z,

        0.86,
        0.82,
        0.76,

        COLORS.skin,

        player.rotationY
    );

    /* =====================================================
       HAIR
       ===================================================== */

    drawCube(

        player.x,

        player.y +
        2.18 +
        bob,

        player.z,

        0.72,
        0.16,
        0.64,

        COLORS.playerBodyDark,

        player.rotationY
    );

    /* =====================================================
       LEFT LEG
       ===================================================== */

    drawCube(

        player.x -
        rightX * 0.22 +
        sinRotation * leftLegOffset,

        player.y +
        0.35,

        player.z -
        rightZ * 0.22 +
        cosRotation * leftLegOffset,

        0.28,
        0.70,
        0.32,

        COLORS.pants,

        player.rotationY
    );

    /* =====================================================
       RIGHT LEG
       ===================================================== */

    drawCube(

        player.x +
        rightX * 0.22 +
        sinRotation * rightLegOffset,

        player.y +
        0.35,

        player.z +
        rightZ * 0.22 +
        cosRotation * rightLegOffset,

        0.28,
        0.70,
        0.32,

        COLORS.pants,

        player.rotationY
    );

    /* =====================================================
       LEFT SHOE
       ===================================================== */

    drawCube(

        player.x -
        rightX * 0.22 +
        sinRotation *
        (leftLegOffset + 0.06),

        player.y +
        0.08,

        player.z -
        rightZ * 0.22 +
        cosRotation *
        (leftLegOffset + 0.06),

        0.34,
        0.18,
        0.42,

        COLORS.shoes,

        player.rotationY
    );

    /* =====================================================
       RIGHT SHOE
       ===================================================== */

    drawCube(

        player.x +
        rightX * 0.22 +
        sinRotation *
        (rightLegOffset + 0.06),

        player.y +
        0.08,

        player.z +
        rightZ * 0.22 +
        cosRotation *
        (rightLegOffset + 0.06),

        0.34,
        0.18,
        0.42,

        COLORS.shoes,

        player.rotationY
    );

    /* =====================================================
       FACE DIRECTIONS
       ===================================================== */

    const frontX =
        sinRotation;

    const frontZ =
        cosRotation;

    /*
        Right side of face.
    */

    const faceRightX =
        cosRotation;

    const faceRightZ =
        -sinRotation;

    /* =====================================================
       LEFT EYE
       ===================================================== */

    drawCube(

        player.x +
        frontX * 0.385 -
        faceRightX * 0.18,

        player.y +
        1.90 +
        bob,

        player.z +
        frontZ * 0.385 -
        faceRightZ * 0.18,

        0.13,
        0.16,
        0.07,

        COLORS.black,

        player.rotationY
    );

    /* =====================================================
       RIGHT EYE
       ===================================================== */

    drawCube(

        player.x +
        frontX * 0.385 +
        faceRightX * 0.18,

        player.y +
        1.90 +
        bob,

        player.z +
        frontZ * 0.385 +
        faceRightZ * 0.18,

        0.13,
        0.16,
        0.07,

        COLORS.black,

        player.rotationY
    );

    /* =====================================================
       MOUTH
       ===================================================== */

    drawCube(

        player.x +
        frontX * 0.397,

        player.y +
        1.66 +
        bob,

        player.z +
        frontZ * 0.397,

        0.30,
        0.07,
        0.07,

        COLORS.black,

        player.rotationY
    );
}

/* =========================================================
   CROSSHAIR
   ========================================================= */

function createCrosshair() {

    if (
        document.getElementById(
            "axoraCrosshair"
        )
    ) {

        return;
    }

    const crosshair =
        document.createElement(
            "div"
        );

    crosshair.id =
        "axoraCrosshair";

    crosshair.textContent =
        "+";

    crosshair.style.position =
        "fixed";

    crosshair.style.left =
        "50%";

    crosshair.style.top =
        "50%";

    crosshair.style.transform =
        "translate(-50%, -50%)";

    crosshair.style.color =
        "white";

    crosshair.style.fontFamily =
        "Arial, sans-serif";

    crosshair.style.fontSize =
        "24px";

    crosshair.style.fontWeight =
        "bold";

    crosshair.style.textShadow =
        "0 0 5px black";

    crosshair.style.pointerEvents =
        "none";

    crosshair.style.zIndex =
        "10001";

    document.body.appendChild(
        crosshair
    );
}

/* =========================================================
   RENDER
   ========================================================= */

function render() {

    if (
        !gl ||
        !shaderProgram
    ) {

        return;
    }

    resizeCanvas();

    /* SKY */

    gl.clearColor(
        0.06,
        0.12,
        0.24,
        1
    );

    gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
    );

    /* MAKE SURE PROGRAM IS ACTIVE */

    gl.useProgram(
        shaderProgram
    );

    /* PROJECTION */

    const aspect =
        canvas.width /
        canvas.height;

    const projection =
        getPerspectiveMatrix(
            degToRad(70),
            aspect,
            0.1,
            200
        );

    gl.uniformMatrix4fv(
        shaderProgram.projectionLocation,
        false,
        projection
    );

    /* VIEW */

    const view =
        lookAt(

            camera.x,
            camera.y,
            camera.z,

            camera.targetX,
            camera.targetY,
            camera.targetZ

        );

    gl.uniformMatrix4fv(
        shaderProgram.viewLocation,
        false,
        view
    );

    /* WORLD */

    for (
        const block of world
    ) {

        drawCube(

            block.x,
            block.y,
            block.z,

            block.scaleX,
            block.scaleY,
            block.scaleZ,

            block.color
        );
    }

    /* PLAYER */

    drawPlayer();
}

/* =========================================================
   RESIZE
   ========================================================= */

function resizeCanvas() {

    if (
        !canvas ||
        !gl
    ) {

        return;
    }

    const width =
        canvas.clientWidth ||
        window.innerWidth;

    const height =
        canvas.clientHeight ||
        window.innerHeight;

    const pixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    const displayWidth =
        Math.floor(
            width *
            pixelRatio
        );

    const displayHeight =
        Math.floor(
            height *
            pixelRatio
        );

    if (
        canvas.width !==
        displayWidth ||

        canvas.height !==
        displayHeight
    ) {

        canvas.width =
            displayWidth;

        canvas.height =
            displayHeight;
    }

    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );
}

/* =========================================================
   INPUT SETUP
   ========================================================= */

function setupInput() {

    window.addEventListener(
        "keydown",
        event => {

            keys[event.code] =
                true;

            if (
                [
                    "KeyW",
                    "KeyA",
                    "KeyS",
                    "KeyD",
                    "Space"
                ].includes(
                    event.code
                )
            ) {

                event.preventDefault();
            }
        }
    );

    window.addEventListener(
        "keyup",
        event => {

            keys[event.code] =
                false;
        }
    );

    canvas.addEventListener(
        "click",
        () => {

            if (
                document.pointerLockElement !==
                canvas
            ) {

                canvas.requestPointerLock();
            }
        }
    );

    document.addEventListener(
        "pointerlockchange",
        () => {

            mouseLocked =
                document.pointerLockElement ===
                canvas;

            if (mouseLocked) {

                console.log(
                    "Axora Engine: Mouse captured."
                );
            }
            else {

                console.log(
                    "Axora Engine: Mouse released."
                );
            }
        }
    );

    document.addEventListener(
        "mousemove",
        event => {

            if (!mouseLocked) {

                return;
            }

            camera.yaw -=
                event.movementX *
                mouseSensitivity;

            camera.pitch -=
                event.movementY *
                mouseSensitivity;

            camera.pitch =
                clamp(
                    camera.pitch,
                    -1.15,
                    0.75
                );
        }
    );

    canvas.addEventListener(
        "wheel",
        event => {

            event.preventDefault();

            cameraDistance +=
                event.deltaY *
                0.01;

            cameraDistance =
                clamp(
                    cameraDistance,
                    CAMERA_MIN_DISTANCE,
                    CAMERA_MAX_DISTANCE
                );
        },
        {
            passive: false
        }
    );

    window.addEventListener(
        "resize",
        resizeCanvas
    );
}

/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(time) {

    if (!lastTime) {

        lastTime =
            time;
    }

    deltaTime =
        (time - lastTime) /
        1000;

    deltaTime =
        Math.min(
            deltaTime,
            0.05
        );

    lastTime =
        time;

    updatePlayer();

    updateCamera();

    render();

    requestAnimationFrame(
        gameLoop
    );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

function initAxoraEngine() {

    if (axoraEngineStarted) {

        console.log(
            "Axora Engine: Already initialized."
        );

        return;
    }

    axoraEngineStarted =
        true;

    canvas =
        document.getElementById(
            "axoraCanvas"
        );

    if (!canvas) {

        console.error(
            "Axora Engine: Canvas not found."
        );

        axoraEngineStarted =
            false;

        return;
    }

    /* WEBGL */

    gl =
        canvas.getContext(
            "webgl",
            {
                antialias: true,
                alpha: false
            }
        );

    if (!gl) {

        console.error(
            "Axora Engine: WebGL is not supported."
        );

        axoraEngineStarted =
            false;

        return;
    }

    console.log(
        "Axora Engine: WebGL context created."
    );

    /* SHADERS */

    shaderProgram =
        createShaderProgram();

    if (!shaderProgram) {

        console.error(
            "Axora Engine: Failed to create shader program."
        );

        axoraEngineStarted =
            false;

        return;
    }

    /* ACTIVATE PROGRAM */

    gl.useProgram(
        shaderProgram
    );

    /* LOCATIONS */

    shaderProgram.positionLocation =
        gl.getAttribLocation(
            shaderProgram,
            "aPosition"
        );

    shaderProgram.colorLocation =
        gl.getAttribLocation(
            shaderProgram,
            "aColor"
        );

    shaderProgram.projectionLocation =
        gl.getUniformLocation(
            shaderProgram,
            "uProjection"
        );

    shaderProgram.viewLocation =
        gl.getUniformLocation(
            shaderProgram,
            "uView"
        );

    shaderProgram.modelLocation =
        gl.getUniformLocation(
            shaderProgram,
            "uModel"
        );

    /* VERTEX BUFFER */

    vertexBuffer =
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

    gl.enableVertexAttribArray(
        shaderProgram.positionLocation
    );

    gl.vertexAttribPointer(
        shaderProgram.positionLocation,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    /* COLOR BUFFER */

    colorBuffer =
        gl.createBuffer();

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        colorBuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        createCubeColors(
            COLORS.grass
        ),
        gl.DYNAMIC_DRAW
    );

    gl.enableVertexAttribArray(
        shaderProgram.colorLocation
    );

    gl.vertexAttribPointer(
        shaderProgram.colorLocation,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    /* WEBGL SETTINGS */

    gl.enable(
        gl.DEPTH_TEST
    );

    gl.enable(
        gl.CULL_FACE
    );

    gl.cullFace(
        gl.BACK
    );

    gl.depthFunc(
        gl.LEQUAL
    );

    /* WORLD */

    createWorld();

    /* INPUT */

    setupInput();

    /* CROSSHAIR */

    createCrosshair();

    /* INITIAL CAMERA */

    camera.x =
        player.x;

    camera.y =
        player.y + 3;

    camera.z =
        player.z +
        cameraDistance;

    camera.targetX =
        player.x;

    camera.targetY =
        player.y + 1;

    camera.targetZ =
        player.z;

    /* ENGINE LOG */

    console.log(
        "========================================"
    );

    console.log(
        "Axora WebGL Engine v0.5"
    );

    console.log(
        "Rip_Dead Engine initialized."
    );

    console.log(
        "Camera system initialized."
    );

    console.log(
        "AABB collision system initialized."
    );

    console.log(
        "Gravity system initialized."
    );

    console.log(
        "Player rotation initialized."
    );

    console.log(
        "Player eyes initialized."
    );

    console.log(
        "Player legs initialized."
    );

    console.log(
        "Walking animation initialized."
    );

    console.log(
        "Recognizable world loaded."
    );

    console.log(
        "WASD = Move"
    );

    console.log(
        "SPACE = Jump"
    );

    console.log(
        "Click = Capture mouse"
    );

    console.log(
        "Mouse = Orbit camera"
    );

    console.log(
        "Mouse wheel = Zoom"
    );

    console.log(
        "ESC = Release mouse"
    );

    console.log(
        "========================================"
    );

    /* START GAME LOOP */

    requestAnimationFrame(
        gameLoop
    );
}

/* =========================================================
   END
   ========================================================= */