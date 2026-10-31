// useToast keeps the small API the pages already use (`show`, `promise`), on top of beUI's animated toast stack.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AnimatedToastStack, useAnimatedToastStack, type ToastStatus } from "@/components/motion/animated-toast-stack";

type Tone = "success" | "error" | "info" | "neutral" | "warning" | "danger";
type ToastSpec = { title: ReactNode; sub?: ReactNode; description?: ReactNode; tone?: Tone; duration?: number };
type Resolve<A> = ToastSpec | ((a: A) => ToastSpec);
type PromiseOpts<T> = { loading: ToastSpec; success: Resolve<T>; error: Resolve<any> };
type Api = { show: (o: ToastSpec) => string; promise: <T>(p: Promise<T>, o: PromiseOpts<T>) => Promise<T> };

const Ctx = createContext<Api | null>(null);
const toStatus = (t?: Tone): ToastStatus => t === "success" ? "success" : t === "error" || t === "danger" ? "error" : t === "info" || t === "warning" ? "info" : "neutral";

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({ defaultDuration: 4200, limit: 4 });
  const api = useMemo<Api>(() => {
    const res = <A,>(r: Resolve<A>, a: A): ToastSpec => (typeof r === "function" ? r(a) : r);
    return {
      show: (o) => showToast({ title: o.title, description: o.sub ?? o.description, status: toStatus(o.tone), duration: o.duration }),
      promise: async (p, o) => {
        const id = showToast({ title: o.loading.title, description: o.loading.sub, status: "loading", duration: 0, dismissible: false });
        try {
          const v = await p;
          const r = res(o.success, v);
          updateToast(id, { title: r.title, description: r.sub ?? r.description, status: "success", duration: 4200, dismissible: true });
          return v;
        } catch (e) {
          const r = res(o.error, e);
          updateToast(id, { title: r.title, description: r.sub ?? r.description, status: "error", duration: 6000, dismissible: true });
          throw e;
        }
      },
    };
  }, [showToast, updateToast]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} fixed position="bottom-right" />
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}
