import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/shared';

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={FileQuestion}
        title="পেজটি পাওয়া যায়নি"
        description="যে ঠিকানাটি খুঁজছেন তা নেই বা সরিয়ে ফেলা হয়েছে।"
        action={<Link to="/"><Button size="sm">ড্যাশবোর্ডে ফিরে যান</Button></Link>}
      />
    </div>
  );
}
