import ThesisDetail from './ThesisDetail';

export default async function CapitalThesisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ThesisDetail slug={slug} />;
}
