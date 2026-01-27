export default function ColorsPage() {
  const colors = [
    { name: "Gray 950", class: "bg-gray-950", var: "--gray-950" },
    { name: "Gray 900", class: "bg-gray-900", var: "--gray-900" },
    { name: "Gray 850", class: "bg-gray-850", var: "--gray-850" },
    { name: "Gray 800", class: "bg-gray-800", var: "--gray-800" },
    { name: "Gray 750", class: "bg-gray-750", var: "--gray-750" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Color Palette</h1>
        <p className="text-muted-foreground mt-2">
          Custom OKLCH colors defined in globals.css
        </p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {colors.map((color) => (
          <div
            key={color.name}
            className="flex items-center gap-4 p-4 rounded-lg border bg-card"
          >
            <div
              className={`h-16 w-16 rounded-md border shadow-sm ${color.class}`}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-lg">{color.name}</span>
              <code className="text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
                {color.var}
              </code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
