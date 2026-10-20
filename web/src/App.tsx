import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@unlocalhosted/metalui";
import Landing from "./pages/Landing";
import Shell from "./app/Shell";
import { AppState } from "./app/state";
import Vaults, { VaultDetail } from "./pages/Vaults";
import Create from "./pages/Create";
import Claim from "./pages/Claim";
import { Heirs, CheckIns, Activity, Proof, Settings } from "./pages/Misc";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/claim/:id/:i" element={<Claim />} />
          <Route path="/app" element={<AppState><Shell /></AppState>}>
            <Route index element={<Vaults />} />
            <Route path="vault/:id" element={<VaultDetail />} />
            <Route path="create" element={<Create />} />
            <Route path="heirs" element={<Heirs />} />
            <Route path="check-ins" element={<CheckIns />} />
            <Route path="activity" element={<Activity />} />
            <Route path="proof" element={<Proof />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
