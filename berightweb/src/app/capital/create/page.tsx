import type { Metadata } from 'next';
import CreateThesisForm from './CreateThesisForm';

export const metadata: Metadata = {
  title: 'Create a Thesis — BeRight Capital',
  description: 'Submit a machine-readable prediction thesis for BeRight devnet risk review.',
};

export default function CreateThesisPage() {
  return <CreateThesisForm />;
}
