import { PosRegister } from "@/components/pos/PosRegister";
import { listPosProducts } from "@/lib/pos";
export default async function PosPage() {
  return <PosRegister initialProducts={await listPosProducts(true)} />;
}
