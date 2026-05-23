import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faGift,
  faBolt,
  faServer,
  faCogs,
  faShieldAlt,
  faUsers,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";

type FeatureCard = {
  bg: string;
  iconBg: string;
  delay: number;
  icon: typeof faGift;
  title: string;
  body: string;
  bullets: string[];
};

const cards: FeatureCard[] = [
  {
    bg: "from-blue-50 to-blue-100",
    iconBg: "primary-gradient",
    delay: 100,
    icon: faGift,
    title: "100% Free",
    body: "Get your subdomain completely free with no hidden charges, no setup fees, and no monthly costs.",
    bullets: ["No Setup Fees", "No Monthly Charges", "No Hidden Costs"],
  },
  {
    bg: "from-green-50 to-green-100",
    iconBg: "success-gradient",
    delay: 200,
    icon: faBolt,
    title: "Instant Activation",
    body: "Your subdomain is created and activated instantly. No waiting, no approval process.",
    bullets: ["Immediate Creation", "Auto DNS Setup", "Ready to Use"],
  },
  {
    bg: "from-purple-50 to-purple-100",
    iconBg: "purple-gradient",
    delay: 300,
    icon: faServer,
    title: "Any Hosting Support",
    body: "Use with any hosting provider, Blogger, or our own hosting. Complete flexibility.",
    bullets: ["Custom Hosting", "Blogger Compatible", "Our Hosting Available"],
  },
  {
    bg: "from-orange-50 to-orange-100",
    iconBg: "bg-gradient-to-r from-orange-500 to-orange-600",
    delay: 400,
    icon: faCogs,
    title: "Easy Management",
    body: "Simple order process with automatic DNS updates and easy subdomain management.",
    bullets: ["Easy Order Process", "Auto DNS Updates", "User Dashboard"],
  },
  {
    bg: "from-red-50 to-red-100",
    iconBg: "bg-gradient-to-r from-red-500 to-red-600",
    delay: 500,
    icon: faShieldAlt,
    title: "Secure & Reliable",
    body: "Professional DNS infrastructure with 99.9% uptime and secure subdomain management.",
    bullets: ["99.9% Uptime", "Secure DNS", "Professional Support"],
  },
  {
    bg: "from-teal-50 to-teal-100",
    iconBg: "bg-gradient-to-r from-teal-500 to-teal-600",
    delay: 600,
    icon: faUsers,
    title: "For Everyone",
    body: "Perfect for beginners and developers alike. No technical knowledge required.",
    bullets: ["Beginner Friendly", "Developer Ready", "No Tech Skills Needed"],
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            <FontAwesomeIcon icon={faStar} className="text-primary mr-3" />
            Why Choose sites.bd?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Revolutionary subdomain system with instant creation and unlimited
            possibilities
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`bg-gradient-to-br ${card.bg} rounded-2xl p-8 hover-lift`}
              data-aos="fade-up"
              data-aos-delay={card.delay}
            >
              <div
                className={`${card.iconBg} w-16 h-16 rounded-full flex items-center justify-center mb-6`}
              >
                <FontAwesomeIcon
                  icon={card.icon}
                  className="text-white text-2xl"
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                {card.title}
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">{card.body}</p>
              <ul className="text-gray-600 space-y-2">
                {card.bullets.map((b) => (
                  <li key={b}>
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-green-500 mr-2"
                    />{" "}
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
