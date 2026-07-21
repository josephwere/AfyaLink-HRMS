import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { normalizeRole } from "../utils/normalizeRole";
import { listBillingTransactions, listHospitalMarketplace, routePayment } from "../services/paymentsApi";

export function usePaymentsPage({ user } = {}) {
  const [searchParams] = useSearchParams();
  const initialHospitalId =
    searchParams.get("hospitalId") ||
    localStorage.getItem("afyalink_patient_hospital_id") ||
    "";
  const [hospitalId, setHospitalId] = useState(initialHospitalId);
  const [hospitalOptions, setHospitalOptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [hospitalInfo, setHospitalInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTx, setActiveTx] = useState(null);
  const [methodMsg, setMethodMsg] = useState("");
  const [bankInvoice, setBankInvoice] = useState(null);
  const [processing, setProcessing] = useState(false);

  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const isPrivileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(actorRole);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [data, market] = await Promise.all([
        listBillingTransactions({ hospitalId }),
        hospitalId ? listHospitalMarketplace({ limit: 100 }) : Promise.resolve(null),
      ]);
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setTransactions(rows);
      if (hospitalId && Array.isArray(market?.items)) {
        const byId = market.items.find((h) => String(h._id) === String(hospitalId)) || null;
        setHospitalInfo(byId);
      } else {
        setHospitalInfo(null);
      }
    } catch {
      setMsg("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    if (user) void loadTransactions();
  }, [user, hospitalId, loadTransactions]);

  useEffect(() => {
    if (!user || !isPrivileged) return;
    listHospitalMarketplace({ limit: 200 })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setHospitalOptions(items);
      })
      .catch(() => setHospitalOptions([]));
  }, [user, isPrivileged]);

  useEffect(() => {
    if (hospitalId) {
      localStorage.setItem("afyalink_patient_hospital_id", hospitalId);
    }
  }, [hospitalId]);

  const routePaymentMethod = useCallback(async (method, tx) => {
    const canPay = tx.workflow?.allowedTransitions?.includes("PAID");
    if (!canPay) {
      setMethodMsg("Payment not allowed at this stage");
      return;
    }
    setProcessing(true);
    setMethodMsg("");
    setBankInvoice(null);
    try {
      const payload = {
        method,
        amount: tx.amount,
        currency: tx.currency || "KES",
        transactionId: tx._id,
        phone: tx.phone || user?.phone || "",
        email: user?.email || "",
        name: user?.name || "",
        hospitalId: hospitalId || undefined,
      };
      const data = await routePayment(payload);

      if (method === "stripe") {
        setMethodMsg(
          "Stripe Payment Intent created.\nClient Secret:\n" +
            (data?.data?.clientSecret || data?.clientSecret || "")
        );
      } else if (method === "mpesa") {
        setMethodMsg("M-Pesa STK Push sent. Await confirmation.");
      } else if (method === "flutterwave" || method === "airtel") {
        const link = data?.data?.paymentLink || data?.paymentLink;
        setMethodMsg(link ? `Flutterwave checkout link:\n${link}` : "Flutterwave payment initiated.");
      } else if (method === "paypal") {
        const link = data?.data?.approvalLink || data?.approvalLink;
        setMethodMsg(link ? `PayPal approval link:\n${link}` : "PayPal order created.");
      } else if (method === "crypto") {
        const link = data?.data?.hostedUrl || data?.hostedUrl;
        setMethodMsg(link ? `Crypto checkout link:\n${link}` : "Crypto charge created.");
      } else if (method === "bank") {
        const details = data?.data?.details || data?.details || {};
        const invoice = data?.data?.invoice || data?.invoice || null;
        const lines = [
          "Bank transfer instructions:",
          details.bankName ? `Bank: ${details.bankName}` : null,
          details.accountName ? `Account Name: ${details.accountName}` : null,
          details.accountNumber ? `Account No: ${details.accountNumber}` : null,
          details.branch ? `Branch: ${details.branch}` : null,
          details.swiftCode ? `Swift: ${details.swiftCode}` : null,
          details.instructions ? details.instructions : null,
        ].filter(Boolean);
        setMethodMsg(lines.join("\n") || "Bank transfer initiated.");
        if (invoice?.text) {
          setBankInvoice(invoice);
        }
      } else {
        setMethodMsg("Payment initiated.");
      }

      await loadTransactions();
    } catch (err) {
      setMethodMsg(err.message || "Payment failed.");
    } finally {
      setProcessing(false);
    }
  }, [hospitalId, loadTransactions, user]);

  const methodOptions = useMemo(() => {
    const phone = String(user?.phone || "");
    const isKenya = user?.country === "KE" || phone.startsWith("254") || phone.startsWith("+254");
    const base = [
      { key: "mpesa", label: "M-Pesa", emoji: "📱", recommended: isKenya },
      { key: "airtel", label: "Airtel Money", emoji: "📲", recommended: isKenya },
      { key: "stripe", label: "Card (Stripe)", emoji: "💳" },
      { key: "bank", label: "Bank Transfer", emoji: "🏦" },
      { key: "flutterwave", label: "Flutterwave", emoji: "🌍" },
      { key: "paypal", label: "PayPal", emoji: "🌍", disabled: true },
      { key: "crypto", label: "Crypto", emoji: "💰", disabled: true },
    ];

    if (hospitalInfo && !hospitalInfo?.patientPaymentMethods?.length) {
      return [];
    }
    if (!hospitalInfo?.patientPaymentMethods?.length) {
      return base;
    }

    const mapped = hospitalInfo.patientPaymentMethods
      .filter((m) => m.enabled !== false)
      .map((m) => {
        const type = String(m.type || "").toLowerCase();
        const key = type.includes("mpesa")
          ? "mpesa"
          : type.includes("stripe")
          ? "stripe"
          : type.includes("flutter")
          ? "flutterwave"
          : type.includes("card")
          ? "stripe"
          : type.includes("bank")
          ? "bank"
          : type.includes("paypal")
          ? "paypal"
          : type.includes("crypto")
          ? "crypto"
          : type.includes("airtel")
          ? "airtel"
          : type || "bank";
        return {
          key,
          label: m.label || base.find((b) => b.key === key)?.label || m.type,
          emoji: base.find((b) => b.key === key)?.emoji || "💳",
          details: m,
          recommended: isKenya && ["mpesa", "airtel"].includes(key),
          disabled: base.find((b) => b.key === key)?.disabled,
        };
      });

    return mapped.length ? mapped : base;
  }, [hospitalInfo, user]);

  const paymentSummary = useMemo(() => {
    const ready = transactions.filter((tx) => tx.workflow?.allowedTransitions?.includes("PAID")).length;
    const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const currency = transactions.find((tx) => tx.currency)?.currency || "KES";
    const methodsEnabled = methodOptions.filter((opt) => !opt.disabled).length;
    return {
      totalTransactions: transactions.length,
      ready,
      totalAmountLabel: `${totalAmount.toLocaleString()} ${currency}`,
      methodsEnabled,
    };
  }, [methodOptions, transactions]);

  return {
    hospitalId,
    setHospitalId,
    hospitalOptions,
    transactions,
    hospitalInfo,
    loading,
    msg,
    setMsg,
    activeTx,
    setActiveTx,
    methodMsg,
    setMethodMsg,
    bankInvoice,
    setBankInvoice,
    processing,
    setProcessing,
    loadTransactions,
    routePaymentMethod,
    methodOptions,
    paymentSummary,
    isPrivileged,
  };
}

export default usePaymentsPage;
