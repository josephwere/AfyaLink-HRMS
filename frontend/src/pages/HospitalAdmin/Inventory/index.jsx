import { useEffect, useRef, useState } from "react";
import pharmacyService from "../../../services/pharmacy/service";

const initialForm = { orderId: "", itemId: "", batchNumber: "", registrationNumber: "", manufacturer: "", expiryDate: "", receivedQuantity: "", scannedCode: "", scanMethod: "MANUAL" };

export default function Inventory() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([pharmacyService.listPurchaseOrders(), pharmacyService.listRegulatoryProducts()])
      .then(([orderResult, productResult]) => {
        if (!active) return;
        setOrders((orderResult?.orders || []).filter((order) => order.status === "SHIPPED"));
        setProducts(productResult?.products || []);
      })
      .catch((error) => active && setMessage(error?.message || "Unable to load receiving queue."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const selectedOrder = orders.find((order) => order._id === form.orderId);
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const startScanner = async () => {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera scanning is unavailable on this device. Use a connected scanner or enter the code manually.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new window.BarcodeDetector({ formats: ["qr_code", "data_matrix", "ean_13", "ean_8", "code_128"] });
      setScanning(true);
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }
        const matches = await detector.detect(videoRef.current);
        const rawValue = matches[0]?.rawValue;
        if (rawValue) {
          setField("scannedCode", rawValue);
          setField("scanMethod", "CAMERA");
          try {
            const parsed = JSON.parse(rawValue);
            if (parsed.registrationNumber) setField("registrationNumber", parsed.registrationNumber);
            if (parsed.batchNumber) setField("batchNumber", parsed.batchNumber);
            if (parsed.manufacturer) setField("manufacturer", parsed.manufacturer);
            if (parsed.expiryDate) setField("expiryDate", parsed.expiryDate);
          } catch {
            // The backend parses GS1 identifiers and retains the raw scan evidence.
          }
          setMessage("Code captured. Review the evidence, then verify and receive.");
          setScanning(false);
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        scanFrameRef.current = requestAnimationFrame(scan);
      };
      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (error) {
      setScanning(false);
      setMessage(error?.message || "Camera access was not available.");
    }
  };
  const verifyAndReceive = async (event) => {
    event.preventDefault();
    setMessage("");
    setResult(null);
    const payload = { itemId: form.itemId, batchNumber: form.batchNumber, supplierId: selectedOrder?.supplier?._id, purchaseOrderId: form.orderId, registrationNumber: form.registrationNumber, manufacturer: form.manufacturer, expiryDate: form.expiryDate, scannedCode: form.scannedCode, scanMethod: form.scanMethod, receivedQuantity: Number(form.receivedQuantity) };
    try {
      const verification = await pharmacyService.verifyBatch(payload);
      setResult(verification);
      await pharmacyService.receivePurchaseOrder(form.orderId, { items: [payload] });
      setMessage("Batch verified and goods receipt recorded. Pharmacy stock has been updated.");
      setOrders((current) => current.filter((order) => order._id !== form.orderId));
      setForm(initialForm);
    } catch (error) {
      setResult(error?.data || null);
      setMessage(error?.message || "Batch verification or receiving failed.");
    }
  };

  return (
    <div className="dashboard">
      <section className="section">
        <div className="card">
          <h1>Hospital Receiving</h1>
          <p className="muted">Verify regulatory identity and supplier evidence before stock enters pharmacy inventory.</p>
          {message ? <div className="alert-item" style={{ marginTop: 12 }}>{message}</div> : null}
          <div style={{ marginTop: 18 }}>
            <button type="button" onClick={startScanner}>{scanning ? "Scanning..." : "Scan QR or barcode"}</button>
            <video ref={videoRef} muted playsInline style={{ display: scanning ? "block" : "none", width: "100%", maxWidth: 420, marginTop: 12 }} />
          </div>
          <form onSubmit={verifyAndReceive} style={{ display: "grid", gap: 12, marginTop: 18, maxWidth: 760 }}>
            <label>Shipped purchase order
              <select required value={form.orderId} onChange={(event) => setField("orderId", event.target.value)}><option value="">Select purchase order</option>{orders.map((order) => <option value={order._id} key={order._id}>{order._id} · {order?.supplier?.name || "Supplier"}</option>)}</select>
            </label>
            <label>Medication
              <select required value={form.itemId} onChange={(event) => setField("itemId", event.target.value)}><option value="">Select item</option>{(selectedOrder?.items || []).map((item) => <option value={item.itemId} key={item.itemId}>{item.name} · expected {item.quantity}</option>)}</select>
            </label>
            <label>PPB registration number<input required value={form.registrationNumber} onChange={(event) => setField("registrationNumber", event.target.value)} placeholder="Registration number" /></label>
            <label>Batch / lot number<input required value={form.batchNumber} onChange={(event) => setField("batchNumber", event.target.value)} placeholder="Scan or enter batch number" /></label>
            <label>Manufacturer<input required value={form.manufacturer} onChange={(event) => setField("manufacturer", event.target.value)} placeholder="Manufacturer on pack" /></label>
            <label>Expiry date<input required type="date" value={form.expiryDate} onChange={(event) => setField("expiryDate", event.target.value)} /></label>
            <label>Accepted quantity<input required min="0" type="number" value={form.receivedQuantity} onChange={(event) => setField("receivedQuantity", event.target.value)} /></label>
            <label>Scanned code<input value={form.scannedCode} onChange={(event) => setField("scannedCode", event.target.value)} placeholder="QR or barcode value" /></label>
            <button type="submit" disabled={loading || !orders.length}>Verify and receive</button>
          </form>
          {result?.riskSignals?.length ? <div className="alert-item" style={{ marginTop: 16 }}>Regulatory hold: {result.riskSignals.join(", ")}</div> : null}
          {!loading && !orders.length ? <p className="muted" style={{ marginTop: 16 }}>No shipped purchase orders awaiting receipt.</p> : null}
          {products.length ? <p className="muted" style={{ marginTop: 16 }}>{products.length} regulatory product records available for verification.</p> : null}
        </div>
      </section>
    </div>
  );
}
