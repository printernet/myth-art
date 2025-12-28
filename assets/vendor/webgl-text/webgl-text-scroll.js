/* Scroll-driven WebGL text wiggle variant
   - Looks for `.webgl-text-root.scroll-variant` elements
   - Reads text from `.webgl-source` children (single DOM source)
   - Renders the text to an offscreen 2D canvas used as a texture
   - Uses a simple vertex shader to displace UVs in proportion to scroll speed
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
    "\nprecision mediump float;\nattribute vec2 a_pos;\nattribute vec2 a_uv;\nvarying vec2 v_uv;\nuniform float u_amount;\nuniform float u_time;\nvoid main(){\n  // flip V so the canvas texture (drawn top->bottom) maps correctly\n  v_uv = vec2(a_uv.x, 1.0 - a_uv.y);\n  // vertical wiggle (based on x coordinate) and horizontal wiggle (based on y coordinate)\n  float dispY = sin((a_uv.x * 12.0) + u_time * 4.0) * u_amount;\n  float dispX = cos((a_uv.y * 8.0) + u_time * 3.0) * u_amount * 0.6;\n  vec2 pos = a_pos;\n  // amplify vertical/horizontal displacement for visibility when scrolling\n  pos.y += dispY * 0.12;\n  pos.x += dispX * 0.06;\n  gl_Position = vec4(pos, 0.0, 1.0);\n}\n";

  var FS =
    "\nprecision mediump float;\nvarying vec2 v_uv;\nuniform sampler2D u_tex;\nuniform float u_amount;\nvoid main(){\n  float a = clamp(u_amount, 0.0, 1.0);\n  // small UV offset proportional to scroll-driven amount\n  float wobble = a * 0.03;\n  // add slight v-dependent modulation so the split looks organic\n  float mod = sin(v_uv.x * 30.0) * 0.5 + 0.5;\n  vec2 off = vec2(wobble * (0.6 + mod * 0.8), wobble * 0.35);\n  // sample red, green, blue with offsets\n  vec4 cr = texture2D(u_tex, v_uv + off);\n  vec4 cg = texture2D(u_tex, v_uv);\n  vec4 cb = texture2D(u_tex, v_uv - off);\n  float alpha = max(max(cr.a, cg.a), cb.a);\n  gl_FragColor = vec4(cr.r, cg.g, cb.b, alpha);\n}\n";

  function initRoot(root) {
    var sources = root.querySelectorAll(".webgl-source");
    if (!sources.length) return;

    // create GL canvas
    var canvas = document.createElement("canvas");
    canvas.className = "webgl-text-glcanvas";
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
      console.error("WebGL text shader program failed to compile/link.");
      return;
    }
    gl.useProgram(program);
    // ensure sampler is bound to texture unit 0
    var texLoc = gl.getUniformLocation(program, "u_tex");
    if (texLoc !== null) gl.uniform1i(texLoc, 0);

    // quad
    var posLoc = gl.getAttribLocation(program, "a_pos");
    var uvLoc = gl.getAttribLocation(program, "a_uv");
    var amountLoc = gl.getUniformLocation(program, "u_amount");
    var timeLoc = gl.getUniformLocation(program, "u_time");

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
      // measure total height required
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
      tctx.fillStyle = "#f4bbff";
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

    // scroll speed tracker
    var lastY = window.scrollY || window.pageYOffset || 0;
    var lastT = performance.now();
    var amount = 0; // 0..1

    function onScroll() {
      var now = performance.now();
      var y = window.scrollY || window.pageYOffset || 0;
      var dt = Math.max(1, now - lastT);
      var dy = Math.abs(y - lastY);
      var s = dy / dt; // px per ms
      // stronger sensitivity so small scrolls are visible
      var scaled = Math.min(1, s * 1.2); // less sensitive to scroll speed
      // prefer recent scrolls but allow some smoothing
      amount = Math.max(amount * 0.96, scaled); // slower to drop on new scroll
      lastY = y;
      lastT = now;
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    var then = performance.now();
    function draw(now) {
      now = now || performance.now();
      var dt = (now - then) * 0.001;
      then = now;
      amount *= 0.975; // slower decay, effect lingers longer
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
      gl.uniform1f(amountLoc, amount);
      gl.uniform1f(timeLoc, now * 0.001);
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
    var roots = document.querySelectorAll(".webgl-text-root.scroll-variant");
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
