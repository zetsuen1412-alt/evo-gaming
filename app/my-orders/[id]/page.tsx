import { redirect } from "next/navigation";

type Props = {
  params: {
    id: string;
  };
};

export default function MyOrderDetailRedirect({ params }: Props) {
  redirect(`/order/${params.id}`);
}