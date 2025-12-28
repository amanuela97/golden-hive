"use client";

import { useState } from "react";
import { ProductReviewForm } from "../components/reviews/ProductReviewForm";
import { StoreReviewForm } from "../components/reviews/StoreReviewForm";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReviewPageClientProps {
  orderId: string;
  orderNumber: string;
  productData: {
    id: string;
    name: string;
    imageUrl?: string | null;
    storeName: string;
    storeLogo?: string | null;
  } | null;
  storeData: {
    id: string;
    storeName: string;
    logoUrl?: string | null;
  } | null;
  isAuthenticated: boolean;
  userName?: string;
  userEmail?: string;
  hasProductParam?: boolean;
  hasStoreParam?: boolean;
}

export function ReviewPageClient({
  orderId,
  orderNumber,
  productData,
  storeData,
  isAuthenticated,
  userName,
  userEmail,
  hasProductParam = false,
  hasStoreParam = false,
}: ReviewPageClientProps) {
  const [productSubmitted, setProductSubmitted] = useState(false);
  const [storeSubmitted, setStoreSubmitted] = useState(false);

  if (!productData && !storeData) {
    let errorMessage = "Please provide a product or store ID in the URL.";
    
    if (hasProductParam && !productData) {
      errorMessage = "The product you're trying to review is not in this order, or the product ID is invalid.";
    } else if (hasStoreParam && !storeData) {
      errorMessage = "The store you're trying to review is not associated with this order, or the store ID is invalid.";
    }
    
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {productData && storeData && (
        <Tabs defaultValue="product" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="product">Review Product</TabsTrigger>
            <TabsTrigger value="store">Review Store</TabsTrigger>
          </TabsList>
          <TabsContent value="product">
            <Card className="p-6">
              {productSubmitted ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold mb-2">
                    Thank you for your review!
                  </h2>
                  <p className="text-muted-foreground">
                    Your feedback helps other buyers.
                  </p>
                </div>
              ) : (
                <ProductReviewForm
                  listingId={productData.id}
                  orderId={orderId}
                  productName={productData.name}
                  productImage={productData.imageUrl || undefined}
                  storeName={productData.storeName}
                  isAuthenticated={isAuthenticated}
                  userName={userName}
                  userEmail={userEmail}
                  onSuccess={() => setProductSubmitted(true)}
                />
              )}
            </Card>
          </TabsContent>
          <TabsContent value="store">
            <Card className="p-6">
              {storeSubmitted ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold mb-2">
                    Thank you for your review!
                  </h2>
                  <p className="text-muted-foreground">
                    Your feedback helps other buyers.
                  </p>
                </div>
              ) : (
                <StoreReviewForm
                  storeId={storeData.id}
                  orderId={orderId}
                  storeName={storeData.storeName}
                  storeLogo={storeData.logoUrl || undefined}
                  isAuthenticated={isAuthenticated}
                  userName={userName}
                  userEmail={userEmail}
                  onSuccess={() => setStoreSubmitted(true)}
                />
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {productData && !storeData && (
        <Card className="p-6">
          {productSubmitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">
                Thank you for your review!
              </h2>
              <p className="text-muted-foreground">
                Your feedback helps other buyers.
              </p>
            </div>
          ) : (
            <ProductReviewForm
              listingId={productData.id}
              orderId={orderId}
              productName={productData.name}
              productImage={productData.imageUrl || undefined}
              storeName={productData.storeName}
              isAuthenticated={isAuthenticated}
              userName={userName}
              userEmail={userEmail}
              onSuccess={() => setProductSubmitted(true)}
            />
          )}
        </Card>
      )}

      {storeData && !productData && (
        <Card className="p-6">
          {storeSubmitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">
                Thank you for your review!
              </h2>
              <p className="text-muted-foreground">
                Your feedback helps other buyers.
              </p>
            </div>
          ) : (
            <StoreReviewForm
              storeId={storeData.id}
              orderId={orderId}
              storeName={storeData.storeName}
              storeLogo={storeData.logoUrl || undefined}
              isAuthenticated={isAuthenticated}
              userName={userName}
              userEmail={userEmail}
              onSuccess={() => setStoreSubmitted(true)}
            />
          )}
        </Card>
      )}
    </div>
  );
}
