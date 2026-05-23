import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags, faCheck, faGift } from "@fortawesome/free-solid-svg-icons";

const bullets = [
  "yourname.sites.bd subdomain",
  "Instant activation",
  "Connect to any hosting",
  "Use with Blogger",
  "Automatic DNS updates",
  "24/7 DNS support",
  "No setup fees",
  "No monthly charges",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            <FontAwesomeIcon icon={faTags} className="text-primary mr-3" />
            Simple Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to get started online, completely free
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div
            className="primary-gradient rounded-2xl p-8 hover-lift relative text-center"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-800 px-2 py-2 rounded-full text-sm font-bold">
              COMPLETELY FREE
            </div>
            <div className="text-white">
              <h3 className="text-3xl font-bold mb-4">Free Subdomain</h3>
              <div className="text-6xl font-bold mb-2">$0</div>
              <p className="text-xl opacity-80 mb-8">Forever Free</p>
              <ul className="text-left space-y-4 mb-8 max-w-md mx-auto">
                {bullets.map((b) => (
                  <li key={b}>
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-yellow-400 mr-3"
                    />{" "}
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/check"
                id="pricingOrderBtn"
                className="bg-white text-primary py-4 px-8 rounded-full font-bold text-lg hover-lift w-full md:w-auto inline-flex items-center justify-center"
              >
                <FontAwesomeIcon icon={faGift} className="mr-2" />
                Get Subdomain
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
