const Page = ({ text }: { text: string }) => {
  return (
    <div className="flex min-h-screen flex-1 items-center">
      <p className="text-lg text-foreground">{text}</p>
    </div>
  );
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-row">
      <Page text="hi insert landing page here" />
    </div>
  );
}
