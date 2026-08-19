import FeedbackClient from "./FeedbackClient";

export const metadata = {
  title: "Send Feedback",
  description:
    "Experiencing issues with CodeShift AI, missing a feature, or had a bad conversion? Send a note straight to the developer.",
  alternates: { canonical: "/feedback" }
};

export default function FeedbackPage() {
  return <FeedbackClient />;
}
