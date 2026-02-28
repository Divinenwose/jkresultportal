import { useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import schoolLogo from "@/assets/school-logo.jpeg";
import { SCHOOL_NAME, SCHOOL_MOTTO } from "@/lib/constants";
import { GraduationCap, MailCheck, RefreshCw } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = otp.join("");
    if (token.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Invalid or expired code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } else {
      toast.success("Email verified! Logging you in...");
      navigate("/");
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification code resent! Check your inbox.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center school-gradient p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex justify-center mb-4">
            <img src={schoolLogo} alt="School Logo" className="w-20 h-20 rounded-full object-cover shadow-lg ring-4 ring-secondary" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground">{SCHOOL_NAME}</h1>
          <p className="text-xs text-muted-foreground italic mt-1">"{SCHOOL_MOTTO}"</p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-primary">
            <GraduationCap className="h-4 w-4" />
            <span className="text-sm font-semibold">Result Management Portal</span>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-4">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-display font-semibold">Verify Your Email</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to
            </p>
            <p className="text-sm font-semibold text-primary mt-0.5 break-all">{email || "your email"}</p>
          </div>

          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-bold border-2 rounded-lg bg-background focus:outline-none focus:border-primary transition-colors"
                style={{ borderColor: digit ? 'hsl(var(--primary))' : undefined }}
              />
            ))}
          </div>

          <Button onClick={handleVerify} className="w-full h-10 font-semibold" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Sign In"}
          </Button>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-sm text-primary font-semibold hover:underline flex items-center gap-1 mx-auto disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Resending..." : "Resend Code"}
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/login" className="text-primary font-semibold hover:underline">Back to Sign In</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
