import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faEnvelope,
  faClock,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import {
  faFacebookF,
  faTwitter,
  faLinkedinIn,
  faGithub,
} from "@fortawesome/free-brands-svg-icons";

export function Contact() {
  return (
    <section id="contact" className="py-20 primary-gradient">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Need Help?
          </h2>
          <p className="text-xl text-white opacity-90 max-w-3xl mx-auto">
            Get in touch with our support team for any questions or assistance
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div
              className="glass-effect rounded-2xl p-8"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                Send us a message
              </h3>
              <form id="contactForm" className="space-y-6">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="w-full p-4 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white"
                    required
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Your Email"
                    className="w-full p-4 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white"
                    required
                  />
                </div>
                <div>
                  <select className="w-full p-4 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white">
                    <option>General Question</option>
                    <option>Technical Support</option>
                    <option>Subdomain Issue</option>
                    <option>Hosting Question</option>
                  </select>
                </div>
                <div>
                  <textarea
                    placeholder="Your message"
                    rows={4}
                    className="w-full p-4 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-white text-primary py-4 rounded-lg font-bold text-lg hover-lift"
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  Send Message
                </button>
              </form>
            </div>

            <div
              className="space-y-8"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <div className="glass-effect rounded-xl p-6">
                <div className="flex items-center">
                  <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mr-4">
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className="text-primary"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Email</h4>
                    <p className="text-white opacity-80">help@sites.bd</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-xl p-6">
                <div className="flex items-center">
                  <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mr-4">
                    <FontAwesomeIcon
                      icon={faClock}
                      className="text-primary"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Response Time</h4>
                    <p className="text-white opacity-80">Within 24 hours</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-xl p-6">
                <div className="flex items-center">
                  <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mr-4">
                    <FontAwesomeIcon
                      icon={faHeadset}
                      className="text-primary"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Support</h4>
                    <p className="text-white opacity-80">
                      Free technical support
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-xl p-6">
                <h4 className="text-white font-bold mb-4">Follow Us</h4>
                <div className="flex space-x-4">
                  <a
                    href="#"
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover-lift"
                    aria-label="Facebook"
                  >
                    <FontAwesomeIcon
                      icon={faFacebookF}
                      className="text-primary"
                    />
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover-lift"
                    aria-label="Twitter"
                  >
                    <FontAwesomeIcon
                      icon={faTwitter}
                      className="text-primary"
                    />
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover-lift"
                    aria-label="LinkedIn"
                  >
                    <FontAwesomeIcon
                      icon={faLinkedinIn}
                      className="text-primary"
                    />
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover-lift"
                    aria-label="GitHub"
                  >
                    <FontAwesomeIcon
                      icon={faGithub}
                      className="text-primary"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
