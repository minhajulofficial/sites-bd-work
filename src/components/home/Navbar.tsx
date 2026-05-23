"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGlobe,
  faHome,
  faStar,
  faTags,
  faShoppingCart,
  faEnvelope,
  faRocket,
} from "@fortawesome/free-solid-svg-icons";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 bg-white shadow-lg ${scrolled ? "shadow-xl" : ""}`}
      data-aos="fade-down"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-primary text-2xl font-bold flex items-center">
            <FontAwesomeIcon icon={faGlobe} className="mr-3 text-3xl" />
            SITES.BD
          </div>
          <div className="hidden md:flex space-x-8">
            <a
              href="#home"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faHome} className="mr-2" /> Home
            </a>
            <a
              href="#features"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faStar} className="mr-2" /> Features
            </a>
            <a
              href="#pricing"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faTags} className="mr-2" /> Pricing
            </a>
            <a
              href="#order"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faShoppingCart} className="mr-2" /> Order
            </a>
            <a
              href="#contact"
              className="text-gray-700 hover:text-primary transition-colors duration-300 font-medium"
            >
              <FontAwesomeIcon icon={faEnvelope} className="mr-2" /> Contact
            </a>
          </div>
          <Link
            href="/login"
            className="primary-gradient text-white px-4 py-2 rounded-full font-semibold hover-lift pulse-glow inline-flex items-center"
            id="getStartedBtn"
          >
            <FontAwesomeIcon icon={faRocket} className="mr-2" />
            Get
          </Link>
        </div>
      </div>
    </nav>
  );
}
