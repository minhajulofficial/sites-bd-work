type Props = { params: { number: string } };

export default function TicketDetailPage({ params }: Props) {
  return <div>Ticket {params.number} (PR-19)</div>;
}
