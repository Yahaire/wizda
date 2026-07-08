import { DetailProvider } from '@/components/detail/DetailProvider';
import { OraclePage } from '@/components/oracle/OraclePage';

export default function Home() {
  return (
    <DetailProvider>
      <OraclePage />
    </DetailProvider>
  );
}
