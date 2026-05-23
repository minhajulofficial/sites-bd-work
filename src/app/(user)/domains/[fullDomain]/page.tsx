type Props = { params: { fullDomain: string } };

export default function DomainDetailPage({ params }: Props) {
  return <div>Domain Detail: {params.fullDomain} (PR-14)</div>;
}
