import { useNavigate, useParams } from "react-router-dom";
import { NewQuoteFormV2 } from "@/components/orcamentos-v2/NewQuoteFormV2";

export default function EditQuoteV2() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  return (
    <NewQuoteFormV2
      quoteId={id}
      onDone={() => navigate("/orcamentos-v2")}
      onCancel={() => navigate("/orcamentos-v2")}
    />
  );
}
