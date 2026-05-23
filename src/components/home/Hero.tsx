import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faServer,
  faCloud,
  faGift,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";

export function Hero() {
  return (
    <section
      id="home"
      className="min-h-screen primary-gradient flex items-center justify-center relative overflow-hidden pt-20"
    >
      <div className="absolute top-32 left-10 text-white text-5xl opacity-20 floating-icon">
        <FontAwesomeIcon icon={faGlobe} />
      </div>
      <div
        className="absolute top-40 right-20 text-white text-4xl opacity-20 floating-icon"
        style={{ animationDelay: "1s" }}
      >
        <FontAwesomeIcon icon={faServer} />
      </div>
      <div
        className="absolute bottom-32 left-20 text-white text-6xl opacity-20 floating-icon"
        style={{ animationDelay: "2s" }}
      >
        <FontAwesomeIcon icon={faCloud} />
      </div>

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="max-w-5xl mx-auto">
          <h1
            className="text-2xl md:text-7xl font-bold text-white mb-3"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Free SubDomain Provider
          </h1>
          <h2
            className="text-4xl md:text-4xl font-bold text-white mb-3 typing-animation"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            SITES.BD
          </h2>
          <p
            className="text-xl md:text-2xl text-white mb-2 leading-relaxed opacity-90"
            data-aos="fade-up"
            data-aos-delay="300"
          >
            Get your <strong>FREE subdomain</strong> instantly! Connect to any
            hosting, use with Blogger, and start your online journey with zero
            cost and instant activation.
          </p>
          <div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            data-aos="fade-up"
            data-aos-delay="400"
          >
            <a
              href="#order"
              className="bg-white text-primary px-8 py-4 rounded-full text-xl font-bold hover-lift shadow-2xl inline-flex items-center justify-center"
              id="heroOrderBtn"
            >
              <FontAwesomeIcon icon={faGift} className="mr-3" />
              Get Free Subdomain
            </a>
            <Link
              href="#features"
              className="glass-effect text-white px-8 py-4 rounded-full text-xl font-bold hover-lift inline-flex items-center justify-center"
              id="heroFeaturesBtn"
            >
              <FontAwesomeIcon icon={faPlay} className="mr-3" />
              See Features
            </Link>
          </div>

          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6"
            data-aos="fade-up"
            data-aos-delay="500"
          >
            <div className="glass-effect rounded-xl p-6">
              <div className="text-3xl font-bold text-white mb-2">100%</div>
              <div className="text-white opacity-80">Free Forever</div>
            </div>
            <div className="glass-effect rounded-xl p-6">
              <div className="text-3xl font-bold text-white mb-2">Instant</div>
              <div className="text-white opacity-80">Activation</div>
            </div>
            <div className="glass-effect rounded-xl p-6">
              <div className="text-3xl font-bold text-white mb-2">24/7</div>
              <div className="text-white opacity-80">DNS Updates</div>
            </div>
            <div className="glass-effect rounded-xl p-6">
              <div className="text-3xl font-bold text-white mb-2">Any</div>
              <div className="text-white opacity-80">Hosting</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
