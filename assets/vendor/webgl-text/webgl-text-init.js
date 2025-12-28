(function(){
  // Simple canvas-based animated text effect.
  // Non-destructive: reads DOM text from elements with class `webgl-text-source`
  // and draws an animated stroked/filled text onto an overlay canvas.

  function supportsCanvas(){
    return !!document.createElement('canvas').getContext;
  }

  function initForContainer(container){
    var sources = container.querySelectorAll('.webgl-text-source');
    if(!sources.length) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'webgl-text-canvas';
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var DPR = window.devicePixelRatio || 1;

    function resize(){
      var rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * DPR));
      canvas.height = Math.max(1, Math.floor(rect.height * DPR));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }

    function draw(time){
      time = time || 0;
      var rect = container.getBoundingClientRect();
      ctx.clearRect(0,0,rect.width,rect.height);
      // Build metrics for each source line so we can center the block vertically
      var gap = 10;
      var lines = [];
      var totalHeight = 0;
      sources.forEach(function(el, i){
        var txt = el.textContent.trim().toUpperCase();
        var cssSize = parseFloat(window.getComputedStyle(el).fontSize) || 0;
        var calcSize = Math.min(rect.height * 0.95, Math.max(28, rect.width / Math.max(3, txt.length)));
        var fontSize = cssSize > 0 ? cssSize : calcSize;
        var cssWeight = window.getComputedStyle(el).fontWeight || '700';
        var fontWeight = (/^\d+$/.test(cssWeight)) ? cssWeight : (cssWeight.toLowerCase() === 'bold' ? '700' : '400');
        ctx.font = fontWeight + ' ' + fontSize + 'px "Humane", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        var metrics = ctx.measureText(txt);
        lines.push({text: txt, fontSize: fontSize, metrics: metrics, fontWeight: fontWeight});
        totalHeight += fontSize + gap;
      });
      if(lines.length>0) totalHeight -= gap;
      // Responsiveness: if the block or any line is too large to fit, scale everything down
      var maxLineWidth = 0;
      lines.forEach(function(line){ if(line.metrics && line.metrics.width > maxLineWidth) maxLineWidth = line.metrics.width; });
      var maxAllowedWidth = rect.width * 0.92; // leave small padding
      var widthScale = maxLineWidth > 0 ? (maxAllowedWidth / maxLineWidth) : 1;
      var maxAllowedHeight = rect.height * 0.92;
      var heightScale = totalHeight > 0 ? (maxAllowedHeight / totalHeight) : 1;
      var scale = Math.min(1, widthScale, heightScale);
      if(scale < 1){
        // apply scale to font sizes and recompute metrics & totalHeight
        totalHeight = 0;
        lines.forEach(function(line){
          line.fontSize = Math.max(10, Math.floor(line.fontSize * scale));
          ctx.font = line.fontWeight + ' ' + line.fontSize + 'px "Humane", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          line.metrics = ctx.measureText(line.text);
          totalHeight += line.fontSize + gap * scale;
        });
        if(lines.length>0) totalHeight -= gap * scale;
        gap = gap * scale;
      }
      // starting Y so the block is vertically centered
      var startY = (rect.height - totalHeight)/2;
      var yOffset = 0;
      lines.forEach(function(line, i){
        var fontSize = line.fontSize;
        var txt = line.text;
        var fw = line.fontWeight || '700';
        ctx.font = fw + ' ' + fontSize + 'px "Humane", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f4bbff';
        var x = rect.width/2 - line.metrics.width/2;
        var offset = 0;
        var y = startY + yOffset + fontSize/2;
        for(var c=0;c<txt.length;c++){
          var ch = txt[c];
          var w = ctx.measureText(ch).width;
          var cx = x + offset + w/2;
          var sway = Math.sin((time*0.002) + (c*0.4) + (i*0.5)) * (fontSize*0.08);
          ctx.save();
          ctx.translate(cx,0);
          ctx.rotate(sway*0.0005);
          ctx.translate(-cx,0);
          ctx.fillText(ch, x + offset, y + sway);
          ctx.restore();
          offset += w;
        }
        yOffset += fontSize + gap;
      });
      requestAnimationFrame(draw);
    }

    function start(){
      resize();
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    // Wait for Humane font to load where supported to avoid FOUT in canvas rendering
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 12px "Humane"').then(start).catch(start);
    } else {
      start();
    }
  }

  function init(){
    if(!supportsCanvas()){
      document.documentElement.classList.add('no-webgl');
      return;
    }
    // find masthead containers
    var roots = document.querySelectorAll('.webgl-text-root');
    roots.forEach(function(r){ initForContainer(r); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
