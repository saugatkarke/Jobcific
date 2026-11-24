import Image from "next/image";

export function PricingReview() {
  return (
    <figure className="pricing-review hero-enter hero-enter-4">
      <blockquote className="pricing-review-quote">
        <p>
          Jobcific Pro is totally worth it. I feel less overwhelmed now, and the
          ATS score is already{" "}
          <strong className="pricing-review-stress">doubling my callbacks</strong>{" "}
          from companies.
        </p>
      </blockquote>
      <figcaption className="pricing-review-person">
        <span className="pricing-review-photo-wrap">
          <Image
            src="/reviews/alex.png"
            alt=""
            width={180}
            height={180}
            className="pricing-review-photo"
          />
        </span>
        <div className="min-w-0">
          <p className="pricing-review-name">Ivan Bowler</p>
          <p className="pricing-review-meta">Pro user</p>
        </div>
        <span className="pricing-review-fill" aria-hidden />
        <span className="pricing-review-score" aria-label="Rated 5.0 out of 5">
          <Image
            src="/laurel-left.png"
            alt=""
            width={49}
            height={96}
            unoptimized
            className="pricing-review-laurel"
          />
          <span aria-hidden>5.0</span>
          <Image
            src="/laurel-right.png"
            alt=""
            width={50}
            height={96}
            unoptimized
            className="pricing-review-laurel"
          />
        </span>
      </figcaption>
    </figure>
  );
}
