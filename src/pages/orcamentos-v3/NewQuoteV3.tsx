import { useNavigate } from "react-router-dom";
import { NewQuoteFormV3 } from "@/components/orcamentos-v3/NewQuoteFormV3";

export default function NewQuoteV3() {
  const navigate = useNavigate();
  return (
    <NewQuoteFormV3
      onCancel={() => navigate("/orcamentos-v2")}
      onSave={(r) => navigate(`/orcamentos-v2/${r.id}`)}
    />
  );
}
