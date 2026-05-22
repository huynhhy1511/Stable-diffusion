import React, { useEffect, useRef, useState } from 'react';
import { Canvas, FabricImage } from 'fabric';
import axios from 'axios';

const ImageEditor = ({ imageUrl, maskUrl, onMaskGenerated, customSAM }) => {
  const canvasRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);

  // 1. CHỈ KHỞI TẠO CANVAS MỘT LẦN DUY NHẤT KHI MOUNT COMPONENT
  useEffect(() => {
    if (!canvasRef.current) return;

    const initCanvas = new Canvas(canvasRef.current, {
      selection: false,
      hoverCursor: 'crosshair',
    });

    setCanvas(initCanvas);

    return () => {
      // Dọn dẹp canvas khi unmount
      initCanvas.dispose();
    };
  }, []); // Mảng phụ thuộc rỗng đảm bảo chỉ chạy 1 lần

  // 2. NẠP ẢNH MỚI REACTIVE MỖI KHI imageUrl THAY ĐỔI
  useEffect(() => {
    if (!canvas || !imageUrl) return;

    // Xóa sạch các đối tượng cũ trước khi nạp ảnh mới
    canvas.clear();

    FabricImage.fromURL(imageUrl)
      .then((img) => {
        const maxDim = 512;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
          scale = Math.min(maxDim / img.width, maxDim / img.height);
        }
        setScaleFactor(scale);

        img.set({
          selectable: false,
          evented: false,
          scaleX: scale,
          scaleY: scale,
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top'
        });

        // Thiết lập kích thước canvas và vẽ ảnh nền chuẩn Fabric v7
        canvas.setDimensions({
          width: img.width * scale,
          height: img.height * scale
        });

        // Đặt ảnh làm nền thay vì add object để chắc chắn không bị lệch
        canvas.backgroundImage = img;
        canvas.requestRenderAll();
      })
      .catch((err) => {
        console.error("Lỗi tải ảnh Fabric:", err);
      });
  }, [canvas, imageUrl]);

  // 3. LẮNG NGHE maskUrl ĐỂ THAY ĐỔI MẶT NẠ TRÊN CANVAS REACTIVE
  useEffect(() => {
    if (!canvas) return;

    if (!maskUrl) {
      // Nếu maskUrl bị xóa (null), dọn sạch mask cũ trên canvas
      canvas.getObjects().forEach((obj) => {
        if (obj.id === 'sam-mask') {
          canvas.remove(obj);
        }
      });
      canvas.requestRenderAll();
      return;
    }

    // Vẽ mask mới lên canvas
    drawMaskOnCanvas(maskUrl);
  }, [canvas, maskUrl, scaleFactor]);

  // 4. ĐĂNG KÝ SỰ KIỆN CLICK CHUỘT TRÊN CANVAS
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = async (options) => {
      try {
        if (isProcessing) return;

        // Check if options is defined
        if (!options) {
          console.warn("Fabric options is undefined");
          return;
        }

        // Extract coordinates supporting Fabric v7 scenePoint / options.pointer or DOM fallback
        let pointer = null;
        if (options.scenePoint) {
          pointer = options.scenePoint;
        } else if (options.pointer) {
          pointer = options.pointer;
        } else if (options.e) {
          // Robust DOM fallback
          const canvasElement = canvas.getElement ? canvas.getElement() : null;
          if (canvasElement) {
            const rect = canvasElement.getBoundingClientRect();
            pointer = {
              x: options.e.clientX - rect.left,
              y: options.e.clientY - rect.top
            };
          } else {
            pointer = { x: 0, y: 0 };
          }
        } else {
          pointer = { x: 0, y: 0 };
        }
        
        // Quy đổi tọa độ về kích thước ảnh gốc
        const originalX = Math.round(pointer.x / scaleFactor);
        const originalY = Math.round(pointer.y / scaleFactor);

        console.log(`Clicked coords: (${originalX}, ${originalY})`);
        
        if (customSAM) {
          setIsProcessing(true);
          const resMaskUrl = await customSAM(originalX, originalY);
          setIsProcessing(false);
          if (resMaskUrl && onMaskGenerated) {
            onMaskGenerated(resMaskUrl);
          }
        } else {
          await fetchMask(originalX, originalY);
        }
      } catch (err) {
        console.error("Lỗi click canvas:", err);
        alert("Lỗi click canvas: " + err.message + "\n" + err.stack);
      }
    };

    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [canvas, isProcessing, scaleFactor, imageUrl, customSAM]);

  // Hàm vẽ đè Mask lên trên canvas
  const drawMaskOnCanvas = (mask_url) => {
    if (!canvas) return;

    // Xóa mask cũ nếu có
    canvas.getObjects().forEach((obj) => {
      if (obj.id === 'sam-mask') {
        canvas.remove(obj);
      }
    });

    // Overlay mask mới từ MobileSAM
    FabricImage.fromURL(mask_url)
      .then((maskImg) => {
        maskImg.set({
          selectable: false,
          evented: false,
          scaleX: scaleFactor,
          scaleY: scaleFactor,
          opacity: 0.6, // Làm mờ để thấy ảnh nền phía sau
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top'
        });
        maskImg.id = 'sam-mask';
        
        canvas.add(maskImg);
        canvas.requestRenderAll();
      })
      .catch((err) => {
        console.error("Lỗi nạp ảnh Mask:", err);
      });
  };

  const fetchMask = async (x, y) => {
    try {
      setIsProcessing(true);
      
      const responseImg = await fetch(imageUrl);
      const blob = await responseImg.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'image.png');
      formData.append('x', x);
      formData.append('y', y);

      const res = await axios.post('http://localhost:8000/api/editor/sam/segment', formData);
      const { mask_url } = res.data;
      
      if (onMaskGenerated) {
        onMaskGenerated(mask_url);
      }
      
    } catch (err) {
      console.error("Lỗi khi lấy mask:", err);
      alert("Lỗi khi lấy Mask từ MobileSAM!");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', overflow: 'hidden' }} className="shadow-sm">
      {isProcessing && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="backdrop-blur-xs">
          <p style={{ fontWeight: 'bold' }} className="text-slate-800 text-xs tracking-wider uppercase animate-pulse">Đang nạp AI Mask...</p>
        </div>
      )}
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default ImageEditor;
