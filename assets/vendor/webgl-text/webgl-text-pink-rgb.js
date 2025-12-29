/* Pink WebGL text with continuous RGB shift for green-variant overlay
   - Applies to .green-variant elements only
   - Thin font, wider spacing, 2x size
   - Continuous RGB pixel shift effect
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
    "\nprecision mediump float;\nvarying vec2 v_uv;\nuniform sampler2D u_tex;\nuniform float u_time;\nuniform float u_rgbIntensity;\nvoid main(){\n  vec4 original = texture2D(u_tex, v_uv);\n  if(u_rgbIntensity < 0.01) {\n    // No shift, just show original\n    gl_FragColor = original;\n  } else {\n    // RGB shift with variable intensity\n    float wobble = u_rgbIntensity * 0.0125;\n    float mod = sin(v_uv.x * 30.0) * 0.5 + 0.5;\n    vec2 off = vec2(wobble * (0.6 + mod * 0.8), wobble * 0.35);\n    // Sample red, green, blue with offsets\n    vec4 cr = texture2D(u_tex, v_uv + off);\n    vec4 cg = texture2D(u_tex, v_uv);\n    vec4 cb = texture2D(u_tex, v_uv - off);\n    float alpha = max(max(cr.a, cg.a), cb.a);\n    gl_FragColor = vec4(cr.r, cg.g, cb.b, alpha);\n  }\n}\n";

  function initRoot(root) {
    var sources = root.querySelectorAll(".webgl-source");
    if (!sources.length) return;

    // create GL canvas for pink overlay
    var canvas = document.createElement("canvas");
    canvas.className = "webgl-text-glcanvas pink-rgb";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "3"; // Above green (1) and regular canvases (2)
    if (getComputedStyle(root).position === "static")
      root.style.position = "relative";
    root.appendChild(canvas);

    var gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;

    var program = createProgram(gl, VS, FS);
    if (!program) {
      console.error("WebGL pink RGB shader program failed to compile/link.");
      return;
    }

    gl.useProgram(program);
    var texLoc = gl.getUniformLocation(program, "u_tex");
    if (texLoc !== null) gl.uniform1i(texLoc, 0);

    var posLoc = gl.getAttribLocation(program, "a_pos");
    var uvLoc = gl.getAttribLocation(program, "a_uv");
    var timeLoc = gl.getUniformLocation(program, "u_time");
    var rgbIntensityLoc = gl.getUniformLocation(program, "u_rgbIntensity");

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
        // Apply 2x scaling and thin weight
        fs = fs * 2.0;
        var fw = "100"; // Thin weight
        lines.push({ text: txt, fontSize: fs * DPR, fontWeight: fw });
        totalH += fs * DPR + gap;
      });
      if (lines.length) totalH -= gap;
      textCanvas.width = width;
      textCanvas.height = Math.max(32, Math.ceil(totalH));
      tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
      tctx.textBaseline = "middle";
      tctx.fillStyle = "#f4bbff"; // Pink
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
        // Apply letter spacing by drawing character by character
        var letterSpacing = line.fontSize * 0.15;
        var chars = line.text.toUpperCase().split('');
        var totalWidth = 0;
        chars.forEach(function(ch) {
          totalWidth += tctx.measureText(ch).width + letterSpacing;
        });
        totalWidth -= letterSpacing; // Remove last spacing
        var xOffset = -(totalWidth / 2);
        chars.forEach(function(ch) {
          tctx.fillText(ch, x + xOffset, y);
          xOffset += tctx.measureText(ch).width + letterSpacing;
        });
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
// Calculate RGB intensity: fade from 0 to 1 over 40 seconds (20s up, 20s down)
      var cycleTime = 40.0; // 40 second full cycle
      var phase = (now * 0.001) % cycleTime; // Current position in cycle
      var normalizedPhase = phase / cycleTime; // 0 to 1
      // Use sine wave to fade in and out smoothly
      var intensity = Math.sin(normalizedPhase * Math.PI * 2) * 0.5 + 0.5; // 0 to 1

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
      gl.uniform1f(timeLoc, now * 0.001);
      gl.uniform1f(rgbIntensityLoc, intensity
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
    var roots = document.querySelectorAll(".webgl-text-root.green-variant");
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
