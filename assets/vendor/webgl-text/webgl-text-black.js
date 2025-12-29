/* Black WebGL text effect for overlapping hero images
   - Looks for `.webgl-text-root.black-variant` elements
   - Renders black text using HUMANE font
   - Designed to contrast against hero images via negative margin
*/
(function () {
  "use strict";

  function supportsWebGL() {
    try {
      return (
        !!window.WebGLRenderingContext &&
        !!document.createElement("canvas").getContext("webgl")
      );
    } catch (e) {
      return false;
    }
  }

  function createShader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vs, fs) {
    var v = createShader(gl, gl.VERTEX_SHADER, vs);
    if (!v) return null;
    var f = createShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  var VS =
    "\nprecision mediump float;\nattribute vec2 a_pos;\nattribute vec2 a_uv;\nvarying vec2 v_uv;\nvoid main(){\n  v_uv = vec2(a_uv.x, 1.0 - a_uv.y);\n  gl_Position = vec4(a_pos, 0.0, 1.0);\n}\n";

  var FS =
    "\nprecision mediump float;\nvarying vec2 v_uv;\nuniform sampler2D u_tex;\nvoid main(){\n  vec4 c = texture2D(u_tex, v_uv);\n  gl_FragColor = c;\n}\n";

  function initRoot(root) {
    var sources = root.querySelectorAll(".webgl-source");
    if (!sources.length) return;

    // create GL canvas
    var canvas = document.createElement("canvas");
    canvas.className = "webgl-text-glcanvas black";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    if (getComputedStyle(root).position === "static")
      root.style.position = "relative";
    root.appendChild(canvas);

    var gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;

    var program = createProgram(gl, VS, FS);
    if (!program) {
      console.error("WebGL black text shader program failed to compile/link.");
      return;
    }

    gl.useProgram(program);
    var texLoc = gl.getUniformLocation(program, "u_tex");
    if (texLoc !== null) gl.uniform1i(texLoc, 0);

    var posLoc = gl.getAttribLocation(program, "a_pos");
    var uvLoc = gl.getAttribLocation(program, "a_uv");

    var vtx = new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
    ]);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vtx, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    // texture from offscreen canvas
    var textCanvas = document.createElement("canvas");
    var tctx = textCanvas.getContext("2d");

    function renderTextToCanvas() {
      var DPR = window.devicePixelRatio || 1;
      var rect = root.getBoundingClientRect();
      var width = Math.max(64, Math.floor(rect.width * DPR));
      var lines = [];
      var gap = 6 * DPR;
      var totalH = 0;
      sources.forEach(function (el) {
        var txt = (el.textContent || "").trim();
        var cs = getComputedStyle(el);
        var fs = parseFloat(cs.fontSize) || 48;
        var fw = cs.fontWeight || "700";
        lines.push({ text: txt, fontSize: fs * DPR, fontWeight: fw });
        totalH += fs * DPR + gap;
      });
      if (lines.length) totalH -= gap;
      textCanvas.width = width;
      textCanvas.height = Math.max(32, Math.ceil(totalH));
      tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
      tctx.textBaseline = "middle";
      tctx.fillStyle = "#000000"; // Black
      tctx.textAlign = "center";
      var y = 0;
      var startY = (textCanvas.height - totalH) / 2;
      lines.forEach(function (line) {
        tctx.font =
          line.fontWeight +
          " " +
          line.fontSize +
          'px "Humane", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
        var x = textCanvas.width / 2;
        y = startY + line.fontSize / 2;
        tctx.fillText(line.text.toUpperCase(), x, y);
        startY += line.fontSize + gap;
      });
    }

    // create texture
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function updateTexture() {
      renderTextToCanvas();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        textCanvas
      );
    }

    var then = performance.now();
    function draw(now) {
      now = now || performance.now();
      var dt = (now - then) * 0.001;
      then = now;

      var r = root.getBoundingClientRect();
      var DPR = window.devicePixelRatio || 1;
      var w = Math.max(1, Math.floor(r.width * DPR));
      var h = Math.max(1, Math.floor(r.height * DPR));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        updateTexture();
      }
      updateTexture();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(draw);
    }

    updateTexture();
    requestAnimationFrame(draw);
  }

  function init() {
    if (!supportsWebGL()) return;
    var roots = document.querySelectorAll(".webgl-text-root.black-variant");
    roots.forEach(function (r) {
      try {
        initRoot(r);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
