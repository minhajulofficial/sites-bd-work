import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCogs } from "@fortawesome/free-solid-svg-icons";

const steps = [
  {
    delay: 100,
    bg: "primary-gradient",
    title: "Choose Your Subdomain",
    body: "Enter your desired subdomain name and check availability instantly. Choose from yourname.sites.bd",
  },
  {
    delay: 200,
    bg: "success-gradient",
    title: "Instant Creation",
    body: "Your subdomain is created instantly with automatic DNS configuration and immediate activation.",
  },
  {
    delay: 300,
    bg: "purple-gradient",
    title: "Connect & Launch",
    body: "Connect to your hosting or use with Blogger. Your website is ready to go live immediately!",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-gray-100">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            <FontAwesomeIcon icon={faCogs} className="text-primary mr-3" />
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get your free subdomain in just 3 simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="bg-white rounded-xl p-8 shadow-lg hover-lift text-center"
              data-aos="fade-up"
              data-aos-delay={step.delay}
            >
              <div
                className={`${step.bg} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}
              >
                <span className="text-3xl font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
