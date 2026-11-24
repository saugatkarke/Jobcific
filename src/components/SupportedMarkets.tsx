import { TRUST_LINE } from "@/lib/copy";

type CountryCode = "AU" | "NZ" | "UK" | "CA" | "US";
type Board = "Indeed" | "LinkedIn" | "Seek";

const COUNTRIES: Record<
  CountryCode,
  { name: string; cut: "canton" | "center" | "fly"; imageSrc: string }
> = {
  AU: { name: "Australia", cut: "fly", imageSrc: "/australia_flag.webp" },
  NZ: { name: "New Zealand", cut: "fly", imageSrc: "/new-zealand_flag.webp" },
  UK: { name: "United Kingdom", cut: "center", imageSrc: "/UK_flag.webp" },
  CA: { name: "Canada", cut: "center", imageSrc: "/canada_flag.webp" },
  US: { name: "United States", cut: "canton", imageSrc: "/usa_flag.webp" },
};

const INDEED_MARKETS: CountryCode[] = ["AU", "NZ", "UK", "CA", "US"];
const SEEK_MARKETS: CountryCode[] = ["AU", "NZ"];

function CountryChip({
  country,
  board,
}: {
  country: CountryCode;
  board: Board;
}) {
  const meta = COUNTRIES[country];

  return (
    <span
      className={`trust-chip flag-cut-${meta.cut}`}
      data-country={country.toLowerCase()}
      title={`${meta.name} on ${board}`}
      tabIndex={0}
    >
      <span className="flag-cut" aria-hidden>
        <img
          src={meta.imageSrc}
          alt=""
          className="flag-cut-media"
          aria-hidden
        />
      </span>
      <span className="trust-chip-code">{country}</span>
    </span>
  );
}

function GlobalChip({ board }: { board: Board }) {
  return (
    <span
      className="trust-chip"
      data-country="global"
      title={`Worldwide on ${board}`}
      tabIndex={0}
    >
      <span className="flag-cut flag-cut-global" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" className="flag-cut-media">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4 12h16M12 4c2.2 2.3 3.3 5 3.3 8s-1.1 5.7-3.3 8c-2.2-2.3-3.3-5-3.3-8S9.8 6.3 12 4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="trust-chip-code">Global</span>
    </span>
  );
}

export function SupportedMarkets() {
  return (
    <div className="trust-markets">
      <p className="sr-only">{TRUST_LINE}</p>
      <span>Works on</span>
      <span className="trust-board">Indeed</span>
      {INDEED_MARKETS.map((country) => (
        <CountryChip
          key={`indeed-${country}`}
          country={country}
          board="Indeed"
        />
      ))}
      <span className="trust-board">LinkedIn</span>
      <GlobalChip board="LinkedIn" />
      <span className="trust-and">and</span>
      <span className="trust-board">Seek</span>
      {SEEK_MARKETS.map((country) => (
        <CountryChip key={`seek-${country}`} country={country} board="Seek" />
      ))}
    </div>
  );
}
