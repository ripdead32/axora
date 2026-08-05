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

    gl.enable(gl.DEPTH_TEST);

    let rotation = 0;

    function render() {
        rotation += 0.01;

        gl.clearColor(0.4, 0.7, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = canvas.width / canvas.height;
        const projMatrix = getPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
        gl.uniformMatrix4fv(uniforms.projectionMatrix, false, projMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.normal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        function drawPart(x, y, z, sx, sy, sz, color) {
            const colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, createColorArray(...color), gl.STATIC_DRAW);
            gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribs.color);

            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);

            const mvMatrix = new Float32Array([
                sx * cosR,  0,          -sz * sinR, 0,
                0,          sy,          0,         0,
                sx * sinR,  0,           sz * cosR, 0,
                x * cosR + z * sinR, y, -x * sinR + z * cosR - 16, 1
            ]);

            gl.uniformMatrix4fv(uniforms.modelViewMatrix, false, mvMatrix);
            gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        }

        drawPart(0, -3.0, 0, 8.0, 0.4, 8.0, [0.3, 0.7, 0.3]);

        drawPart(0, 2.0, 0, 0.6, 0.6, 0.6, [1.0, 0.8, 0.1]);
        drawPart(0, 0.7, 0, 0.6, 0.7, 0.3, [0.1, 0.5, 0.9]);
        drawPart(-0.9, 0.7, 0, 0.3, 0.7, 0.3, [1.0, 0.8, 0.1]);
        drawPart(0.9, 0.7, 0, 0.3, 0.7, 0.3, [1.0, 0.8, 0.1]);
        drawPart(-0.35, -0.7, 0, 0.25, 0.7, 0.3, [0.7, 0.1, 0.1]);
        drawPart(0.35, -0.7, 0, 0.25, 0.7, 0.3, [0.7, 0.1, 0.1]);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

window.onload = initAxoraEngine;
