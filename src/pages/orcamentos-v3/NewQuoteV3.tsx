import { useNavigate, useParams } from "react-router-dom";
import { NewQuoteFormV3 } from "@/components/orcamentos-v3/NewQuoteFormV3";

export default function NewQuoteV3() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  return (
    <NewQuoteFormV3
      editingQuoteId={id ?? null}
      onCancel={() => navigate("/orcamentos")}
      onSave={() => navigate("/orcamentos")}
    />
  );
}
