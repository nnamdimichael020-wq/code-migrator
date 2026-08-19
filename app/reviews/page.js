import ReviewsClient from "./ReviewsClient";

export const metadata = {
  title: "Reviews",
  description:
    "What developers say about CodeShift AI — and a place to leave your own review after a conversion.",
  alternates: { canonical: "/reviews" }
};

export default function ReviewsPage() {
  return <ReviewsClient />;
}
