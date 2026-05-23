type Props = { params: { number: string } };

export default function InvoiceDetailPage({ params }: Props) {
  return <div>Invoice {params.number} (PR-18)</div>;
}
