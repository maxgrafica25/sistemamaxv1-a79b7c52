import { useNavigate } from "react-router-dom";
import { NewQuoteFormV2 } from "@/components/orcamentos-v2/NewQuoteFormV2";

export default function NewQuoteV2() {
  const navigate = useNavigate();
  return (
    <NewQuoteFormV2
      onDone={() => navigate("/orcamentos-v2")}
      onCancel={() => navigate("/orcamentos-v2")}
    />
  );
}
