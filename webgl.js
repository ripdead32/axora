const axoraShaders = {
    vertex: `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute vec3 aColor;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;

        varying lowp vec3 vColor;
        varying lowp vec3 vLighting;

        void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            vColor = aColor;

            vec3 ambientLight = vec3(0.5, 0.5, 0.5);
            vec3 directionalLightColor = vec3(0.7, 0.7, 0.65);
            vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));

            float directional = max(dot(aNormal, directionalVector), 0.0);
            vLighting = ambientLight + (directionalLightColor * directional);
        }
    `,
    fragment: `
        varying lowp vec3 vColor;
        varying lowp vec3 vLighting;

        void main(void) {
            gl_FragColor = vec4(vColor * vLighting, 1.0);
        }
    `
};

let axoraTestNothing = true;

function initAxoraEngine() {
    const canvas = document.getElementById("axoraCanvas");
    const gl = canvas.getContext("webgl");

    if (!gl) return;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertShader = createShader(gl, gl.VERTEX_SHADER, axoraShaders.vertex);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, axoraShaders.fragment);

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const attribs = {
        position: gl.getAttribLocation(program, "aPosition"),
        normal: gl.getAttribLocation(program, "aNormal"),
        color: gl.getAttribLocation(program, "aColor"),
    };
    const uniforms = {
        projectionMatrix: gl.getUniformLocation(program, "uProjectionMatrix"),
        modelViewMatrix: gl.getUniformLocation(program, "uModelViewMatrix"),
    };

    const cubeVertices = new Float32Array([
        -1.0, -1.0,  1.0,   1.0, -1.0,  1.0,   1.0,  1.0,  1.0,  -1.0,  1.0,  1.0,
        -1.0, -1.0, -1.0,  -1.0,  1.0, -1.0,   1.0,  1.0, -1.0,   1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,  -1.0,  1.0,  1.0,   1.0,  1.0,  1.0,   1.0,  1.0, -1.0,
        -1.0, -1.0, -1.0,   1.0, -1.0, -1.0,   1.0, -1.0,  1.0,  -1.0, -1.0,  1.0,
         1.0, -1.0, -1.0,   1.0,  1.0, -1.0,   1.0,  1.0,  1.0,   1.0, -1.0,  1.0,
        -1.0, -1.0, -1.0,  -1.0, -1.0,  1.0,  -1.0,  1.0,  1.0,  -1.0,  1.0, -1.0,
    ]);

    const cubeNormals = new Float32Array([
         0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
         0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
         0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
         0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
         1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
        -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,
    ]);

    const cubeIndices = new Uint16Array([
        0,  1,  2,      0,  2,  3,
        4,  5,  6,      4,  6,  7,
        8,  9,  10,     8,  10, 11,
        12, 13, 14,     12, 14, 15,
        16, 17, 18,     16, 18, 19,
        20, 21, 22,     20, 22, 23,
    ]);

    function createColorArray(r, g, b) {
        let colors = [];
        for (let i = 0; i < 24; i++) {
            colors.push(r, g, b);
        }
        return new Float32Array(colors);
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

    function getPerspectiveMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const rangeInv = 1.0 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ]);
    }

    let playerX = 0;
    let playerZ = 0;
    let playerYaw = 0;

    let camYaw = 0;
    let camPitch = 0.35;
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const keys = {};

    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => { isMouseDown = false; });

    window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        camYaw -= deltaX * 0.005;
        camPitch += deltaY * 0.005;
        camPitch = Math.max(-0.2, Math.min(1.2, camPitch));
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    gl.enable(gl.DEPTH_TEST);

    function render() {
        let moveX = 0;
        let moveZ = 0;

        if (keys['w'] || keys['arrowup']) moveZ -= 1;
        if (keys['s'] || keys['arrowdown']) moveZ += 1;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;

        if (moveX !== 0 || moveZ !== 0) {
            const speed = 0.15;
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length;
            moveZ /= length;

            const cosCam = Math.cos(camYaw);
            const sinCam = Math.sin(camYaw);

            const worldMoveX = moveX * cosCam - moveZ * sinCam;
            const worldMoveZ = moveX * sinCam + moveZ * cosCam;

            playerX += worldMoveX * speed;
            playerZ += worldMoveZ * speed;
            playerYaw = Math.atan2(worldMoveX, worldMoveZ);
        }

        gl.clearColor(0.4, 0.7, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = canvas.width / canvas.height;
        const projMatrix = getPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 200.0);
        gl.uniformMatrix4fv(uniforms.projectionMatrix, false, projMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.normal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        const camDist = 18;
        const camX = playerX + camDist * Math.sin(camYaw) * Math.cos(camPitch);
        const camY = 3.0 + camDist * Math.sin(camPitch);
        const camZ = playerZ + camDist * Math.cos(camYaw) * Math.cos(camPitch);

        function drawPart(x, y, z, sx, sy, sz, color, ry = 0) {
            const colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, createColorArray(...color), gl.STATIC_DRAW);
            gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribs.color);

            let relX = x - camX;
            let relY = y - camY;
            let relZ = z - camZ;

            const cosY = Math.cos(-camYaw);
            const sinY = Math.sin(-camYaw);

            let rx1 = relX * cosY - relZ * sinY;
            let rz1 = relX * sinY + relZ * cosY;

            const cosP = Math.cos(-camPitch);
            const sinP = Math.sin(-camPitch);

            let ry2 = relY * cosP - rz1 * sinP;
            let rz2 = relY * sinP + rz1 * cosP;

            const cosRot = Math.cos(ry - camYaw);
            const sinRot = Math.sin(ry - camYaw);

            const mvMatrix = new Float32Array([
                sx * cosRot,                sx * sinRot * sinP,         -sx * sinRot * cosP,        0,
                0,                          sy * cosP,                  sy * sinP,                  0,
                sz * sinRot,                -sz * cosRot * sinP,        sz * cosRot * cosP,         0,
                rx1,                        ry2,                        rz2,                        1
            ]);

            gl.uniformMatrix4fv(uniforms.modelViewMatrix, false, mvMatrix);
            gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        }

        drawPart(0, -1.0, 0, 60.0, 0.4, 60.0, [0.3, 0.7, 0.3]);

        for (let i = -50; i <= 50; i += 10) {
            for (let j = -50; j <= 50; j += 10) {
                if (i !== 0 || j !== 0) {
                    drawPart(i, -0.7, j, 4.9, 0.1, 4.9, [0.25, 0.65, 0.25]);
                }
            }
        }

        drawPart(playerX, 3.2, playerZ, 0.6, 0.6, 0.6, [1.0, 0.8, 0.1], playerYaw);
        drawPart(playerX, 1.9, playerZ, 0.6, 0.7, 0.3, [0.1, 0.5, 0.9], playerYaw);
        
        const armOffset1X = 0.9 * Math.cos(playerYaw);
        const armOffset1Z = -0.9 * Math.sin(playerYaw);
        drawPart(playerX - armOffset1X, 1.9, playerZ - armOffset1Z, 0.3, 0.7, 0.3, [1.0, 0.8, 0.1], playerYaw);
        drawPart(playerX + armOffset1X, 1.9, playerZ + armOffset1Z, 0.3, 0.7, 0.3, [1.0, 0.8, 0.1], playerYaw);

        const legOffset1X = 0.35 * Math.cos(playerYaw);
        const legOffset1Z = -0.35 * Math.sin(playerYaw);
        drawPart(playerX - legOffset1X, 0.5, playerZ - legOffset1Z, 0.25, 0.7, 0.3, [0.7, 0.1, 0.1], playerYaw);
        drawPart(playerX + legOffset1X, 0.5, playerZ + legOffset1Z, 0.25, 0.7, 0.3, [0.7, 0.1, 0.1], playerYaw);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

window.onload = initAxoraEngine;
