interface ProductPageProps {
  params: {
    id: string;
  };
}

export default function ProductDetails({ params }: ProductPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold text-center">
        Product Details - {params.id}
      </h1>
    </div>
  );
}
