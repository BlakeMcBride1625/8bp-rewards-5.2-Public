import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

type FAQItem = {
	question: string;
	answer: string;
};

const faqItems: FAQItem[] = [
	{
		question: "How does the automated reward system work?",
		answer:
			"Our automated claimer logs into your registered 8 Ball Pool account every six hours, collects the available rewards, and logs the outcome so you can track progress from your dashboard.",
	},
	{
		question: "Is my account safe?",
		answer:
			"Yes. Your credentials are encrypted, never shared, and only used by the claimer service. We also monitor activity to detect unusual behaviour and keep administrators informed.",
	},
	{
		question: "Can I register multiple accounts?",
		answer:
			"Multiple accounts are supported, but each must comply with Miniclip’s fair play rules. If you manage multiple accounts, register each one separately so claims stay isolated.",
	},
	{
		question: "How do I find my 8 Ball Pool User ID?",
		answer:
			"Open 8 Ball Pool, tap your avatar, and copy the numeric ID shown under your profile picture. Paste that ID into the registration form so we can target the correct account.",
	},
	{
		question: "What happens if a claim fails?",
		answer:
			"We retry failed claims automatically and surface the failure reason in your dashboard. If we cannot resolve it, you’ll receive an alert with recommended next steps.",
	},
	{
		question: "How are leaderboard rankings calculated?",
		answer:
			"Leaderboard positions are based on the total successful claims performed on your accounts. We reset rankings monthly so new users have a chance to climb.",
	},
	{
		question: "What can I buy in the rewards shop?",
		answer:
			"The automated claims unlock in-game cues, scratchers, boxes, and other rotating rewards. We mirror whatever Miniclip offers at the time of the claim.",
	},
	{
		question: "Can I track my claim history?",
		answer:
			"Absolutely. The user dashboard shows every claim attempt with timestamps, status, and reward details so you always know what was collected.",
	},
	{
		question: "How do I cancel my registration?",
		answer:
			"Go to your user dashboard, open Account Settings, and click “Cancel Registration.” We immediately stop all automated claims and purge stored credentials.",
	},
	{
		question: "Do I need to be online for claims to work?",
		answer:
			"No. The claimer runs on our infrastructure. As long as your registration is active, claims continue even when you’re offline.",
	},
];

const FAQPage: React.FC = () => {
	// Start with all FAQ items collapsed (null = none open)
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	const handleToggle = (index: number) => {
		setOpenIndex((current) => (current === index ? null : index));
	};

	return (
		<div className="min-h-screen pb-20">
			<section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
				<div className="max-w-6xl mx-auto text-center">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-dark-accent-navy/40 dark:to-dark-accent-ocean/30 text-primary-600 dark:text-text-dark-highlight shadow-lg dark:shadow-dark-accent-navy/20 mb-6"
					>
						<MessageCircle className="w-7 h-7" />
					</motion.div>
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1 }}
						className="text-4xl md:text-5xl font-bold text-text-primary dark:text-text-dark-primary mb-4"
					>
						Frequently Asked Questions
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="text-lg text-text-secondary dark:text-text-dark-secondary max-w-2xl mx-auto"
					>
						Find clear answers to the most common questions about 8 Ball Pool Rewards, from automated claims to leaderboard rankings.
					</motion.p>
				</div>
			</section>

			<section className="relative px-4 sm:px-6 lg:px-8 py-8">
				<div className="max-w-5xl mx-auto">
					<div className="space-y-6">
						{faqItems.map((item, index) => {
							const isOpen = openIndex === index;

							return (
								<motion.div
									key={item.question}
									initial={{ opacity: 0, y: 12 }}
									whileInView={{ opacity: 1, y: 0 }}
									viewport={{ once: true }}
									transition={{ duration: 0.35, delay: index * 0.03 }}
									className="bg-white/80 dark:bg-background-dark-secondary/80 backdrop-blur-subtle border border-gray-200 dark:border-dark-accent-navy rounded-3xl shadow-lg dark:shadow-dark-accent-navy/20 overflow-hidden"
								>
									<button
										type="button"
										onClick={() => handleToggle(index)}
										className="w-full flex items-center justify-between text-left px-6 py-5 md:px-8 md:py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:focus-visible:ring-dark-accent-ocean/60 transition-colors"
									>
										<span className="text-base md:text-lg font-semibold text-text-primary dark:text-text-dark-primary">
											{item.question}
										</span>
										<ChevronDown
											className={`w-5 h-5 text-text-secondary dark:text-text-dark-secondary transform transition-transform duration-200 ${
												isOpen ? "rotate-180" : ""
											}`}
										/>
									</button>
									{isOpen && (
										<div className="px-6 pb-6 md:px-8 md:pb-7 -mt-2">
											<p className="text-sm md:text-base leading-relaxed text-text-secondary dark:text-text-dark-secondary">
												{item.answer}
											</p>
										</div>
									)}
								</motion.div>
							);
						})}
					</div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.4, delay: 0.1 }}
						className="mt-20 rounded-3xl bg-gradient-to-r from-primary-50 via-secondary-50 to-primary-100 dark:from-dark-accent-navy/30 dark:via-dark-accent-ocean/30 dark:to-dark-accent-purple/30 border border-primary-100/60 dark:border-dark-accent-navy/40 shadow-xl dark:shadow-dark-accent-navy/20 p-10 lg:p-12 text-center"
					>
						<h2 className="text-2xl md:text-3xl font-semibold text-text-primary dark:text-text-dark-primary mb-4">
							Still have questions?
						</h2>
						<p className="text-base md:text-lg text-text-secondary dark:text-text-dark-secondary mb-8 max-w-2xl mx-auto">
							Can’t find what you’re looking for? Our support team is online and ready to help with onboarding, troubleshooting, and advanced setup.
						</p>
						<Link
							to="/contact"
							className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 dark:bg-dark-accent-navy rounded-2xl hover:bg-blue-700 dark:hover:bg-dark-accent-blue transition-all duration-200 shadow-lg dark:shadow-dark-accent-navy/40"
						>
							Contact Support
						</Link>
					</motion.div>
				</div>
			</section>
		</div>
	);
};

export default FAQPage;






