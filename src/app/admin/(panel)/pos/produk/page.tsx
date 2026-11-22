import { ProductManager } from "@/components/pos/ProductManager";
import { listPosProducts } from "@/lib/pos";
export default async function ProductsPage() {
  return <ProductManager initialProducts={await listPosProducts()} />;
}
