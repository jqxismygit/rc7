import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { PersonalInfoPage } from "./pages/PersonalInfoPage";
import { PaymentPage } from "./pages/PaymentPage";
import { PaymentLoading } from "./pages/PaymentLoading";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/personal" element={<PersonalInfoPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/payment-loading" element={<PaymentLoading />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
