/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  ChevronRight, 
  MessageSquare, 
  Star, 
  AlertCircle, 
  Lightbulb, 
  ArrowUpRight,
  TrendingUp,
  Layout,
  User,
  Coffee,
  CheckCircle2,
  RefreshCcw,
  Trophy,
  Target,
  History,
  LogOut,
  Building,
  Search,
  Zap,
  Globe
} from 'lucide-react';
import { InterviewPhase, Question, Answer, InterviewFeedback, InterviewSession, CompanyInsight, JobRecommendation } from './types';
import { generateInterviewQuestions, generateFeedback, getCompanyInsights, getJobRecommendations } from './services/geminiService';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [phase, setPhase] = useState<InterviewPhase>(InterviewPhase.WELCOME);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [insights, setInsights] = useState<CompanyInsight | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (phase === InterviewPhase.HISTORY && user) {
      loadHistory();
    }
  }, [phase, user]);

  useEffect(() => {
    if (phase === InterviewPhase.INTERVIEWING && answerRef.current) {
      answerRef.current.focus();
    }
  }, [phase, currentQuestionIndex]);

  const loadHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'interviews'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InterviewSession[];
      setHistory(sessions);
    } catch (err) {
      console.error(err);
      setError('Could not load your interview history.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRoleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) return;
    setPhase(InterviewPhase.COMPANY_SEARCH);
  };

  const handleFetchInsights = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (company.trim()) {
        const companyInsights = await getCompanyInsights(company, role);
        setInsights(companyInsights);
      }
      prepareInterview();
    } catch (err) {
      setError('Could not fetch company insights. Starting general interview instead.');
      prepareInterview();
    }
  };

  const prepareInterview = async () => {
    setIsLoading(true);
    setPhase(InterviewPhase.LOADING_QUESTIONS);
    try {
      const generatedQuestions = await generateInterviewQuestions(role, company || undefined, insights || undefined);
      setQuestions(generatedQuestions);
      setPhase(InterviewPhase.INTERVIEWING);
    } catch (err) {
      setError('Failed to prepare your interview questions.');
      setPhase(InterviewPhase.WELCOME);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (!currentAnswer.trim()) {
      setError('Please provide an answer to continue.');
      return;
    }
    setError(null);

    const newAnswer: Answer = {
      questionId: questions[currentQuestionIndex].id,
      questionText: questions[currentQuestionIndex].text,
      answerText: currentAnswer
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleFinishInterview(updatedAnswers);
    }
  };

  const handleFinishInterview = async (finalAnswers: Answer[]) => {
    setIsLoading(true);
    setPhase(InterviewPhase.GENERATING_FEEDBACK);
    
    try {
      const feedbackResult = await generateFeedback(role, finalAnswers);
      setFeedback(feedbackResult);
      
      const recs = await getJobRecommendations(role, feedbackResult);
      setRecommendations(recs);

      if (user) {
        await addDoc(collection(db, 'interviews'), {
          userId: user.uid,
          role,
          company: company || 'General',
          timestamp: serverTimestamp(),
          answers: finalAnswers,
          feedback: feedbackResult
        });
      }

      setPhase(InterviewPhase.FEEDBACK);
    } catch (err) {
      setError('Failed to generate your performance report.');
      setPhase(InterviewPhase.INTERVIEWING);
    } finally {
      setIsLoading(false);
    }
  };

  const resetInterview = () => {
    setPhase(InterviewPhase.WELCOME);
    setRole('');
    setCompany('');
    setInsights(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentAnswer('');
    setFeedback(null);
    setRecommendations([]);
    setError(null);
  };

  const renderWelcome = () => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto py-24 px-10"
    >
      <div className="flex flex-col md:flex-row gap-16 items-start">
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-muted mb-4 block">Preparation Protocol / v2.0</span>
          <h1 className="text-6xl font-serif italic font-light leading-[1.1] mb-8">
            Master your next <br />
            <span className="text-editorial-ink font-normal not-italic">career milestone</span>
          </h1>
          <p className="text-lg text-editorial-muted leading-relaxed mb-12 max-w-md">
            Structured, role-specific mock interviews that use generative intelligence to test your depth, maturity, and situational judgment.
          </p>

          <form onSubmit={handleStartRoleSearch} className="relative group">
            <div className="flex flex-col gap-4">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Enter Target Position</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  className="flex-1 bg-transparent border-b-2 border-editorial-ink py-4 text-2xl font-serif italic outline-none placeholder:opacity-20 placeholder:italic transition-all focus:border-editorial-accent"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!role.trim() || isLoading}
                  className="px-8 bg-editorial-ink text-editorial-bg uppercase text-[11px] tracking-[0.2em] font-bold hover:bg-editorial-accent transition-colors disabled:opacity-30"
                >
                  {isLoading ? 'Loading' : 'Begin Context'}
                </button>
              </div>
            </div>
          </form>
          {!user && (
            <div className="mt-8 p-4 border border-editorial-ink inline-block">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Cloud Synchronization Required</p>
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-3 bg-white text-editorial-ink border border-editorial-ink px-6 py-2 text-[10px] uppercase tracking-widest font-black hover:bg-stone-50 transition-colors"
              >
                <Globe size={14} /> Sign in to Save Progress
              </button>
            </div>
          )}
        </div>

        <div className="w-full md:w-72 space-y-12">
          <div className="pt-6 border-t border-editorial-ink">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Precision Logic</p>
            <p className="text-sm leading-relaxed text-editorial-muted italic">Tailored questioning based on industry standards and role expectations.</p>
          </div>
          <div className="pt-6 border-t border-editorial-ink">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Deep Reporting</p>
            <p className="text-sm leading-relaxed text-editorial-muted italic">Exhaustive feedback on technical depth, STAR performance, and growth areas.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderCompanySearch = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto py-24 px-10"
    >
      <div className="flex flex-col md:flex-row gap-16">
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-muted mb-4 block">Target Specification / {role}</span>
          <h2 className="text-5xl font-serif italic font-light leading-[1.1] mb-8">
            Tell us about the <br />
            <span className="text-editorial-ink font-normal not-italic">target company</span>
          </h2>
          <p className="text-lg text-editorial-muted leading-relaxed mb-12 max-w-sm">
            Providing a company name allows our engine to tailor questions based on historical data and cultural nuances.
          </p>

          <form onSubmit={handleFetchInsights} className="space-y-8">
            <div className="flex flex-col gap-4">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Company Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Google, Stripe, Sequoia"
                className="w-full bg-transparent border-b-2 border-editorial-ink py-4 text-2xl font-serif italic outline-none placeholder:opacity-20 transition-all"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-editorial-ink text-editorial-bg px-8 py-4 uppercase text-[11px] tracking-[0.2em] font-bold hover:bg-editorial-accent transition-colors disabled:opacity-30"
              >
                {isLoading ? 'Analyzing Company Intelligence...' : 'Connect Intelligence & Start'}
              </button>
              <button
                type="button"
                onClick={() => prepareInterview()}
                className="px-8 py-4 border border-editorial-ink uppercase text-[11px] tracking-[0.2em] font-bold hover:bg-stone-50 transition-colors"
              >
                Skip Company Context
              </button>
            </div>
          </form>
        </div>

        <div className="w-full md:w-72 space-y-12">
          <div className="pt-6 border-t border-editorial-ink">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4 flex items-center gap-2"><Zap size={14} /> Competitive Benchmarking</p>
            <p className="text-sm leading-relaxed text-editorial-muted">We cross-reference current market expectations for {role} against top-tier firms.</p>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-[10px] tracking-widest font-bold text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderHistory = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto py-12 px-10"
    >
      <header className="border-b border-editorial-ink py-10 flex justify-between items-baseline mb-12">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-muted">Session Archives / v2.0</span>
          <h1 className="text-6xl font-serif italic font-light mt-2 leading-none">Your Performance History</h1>
        </div>
        <button onClick={() => setPhase(InterviewPhase.WELCOME)} className="text-[10px] uppercase tracking-widest font-bold underline opacity-50 hover:opacity-100 transition-opacity">Back to Lab</button>
      </header>

      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-2 border-editorial-ink border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[10px] uppercase tracking-widest font-bold">Synchronizing Archives...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-editorial-ink/20">
          <History className="mx-auto text-editorial-ink/10 mb-6" size={48} />
          <p className="text-xl font-serif italic mb-4">No historical sessions identified.</p>
          <button onClick={() => setPhase(InterviewPhase.WELCOME)} className="bg-editorial-ink text-editorial-bg px-8 py-3 uppercase text-[10px] tracking-widest font-bold">Initiate first session</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {history.map((session) => (
            <div key={session.id} className="border border-editorial-ink p-8 flex flex-col justify-between hover:bg-stone-50 transition-colors group">
              <div>
                <div className="flex justify-between items-start mb-12">
                   <div>
                    <p className="text-[9px] uppercase tracking-widest text-editorial-muted font-bold mb-1">
                      {session.timestamp?.toDate().toLocaleDateString() || 'Recent'}
                    </p>
                    <h3 className="text-2xl font-serif italic leading-tight">{session.role}</h3>
                    <p className="text-[10px] uppercase tracking-[0.1em] font-bold opacity-40">{session.company}</p>
                   </div>
                   <div className="text-3xl font-serif border-b border-editorial-ink">{session.feedback.overallScore}</div>
                </div>
                <div className="space-y-4 mb-12">
                   <p className="text-xs font-bold uppercase tracking-widest opacity-50">Core Strengths</p>
                   <ul className="space-y-2">
                     {session.feedback.strengths.slice(0, 2).map((s, i) => (
                       <li key={i} className="text-[11px] font-medium leading-relaxed italic truncate">{s}</li>
                     ))}
                   </ul>
                </div>
              </div>
              <button 
                onClick={() => {
                  setRole(session.role);
                  setCompany(session.company || '');
                  setFeedback(session.feedback);
                  setAnswers(session.answers);
                  setPhase(InterviewPhase.FEEDBACK);
                }}
                className="w-full py-3 border border-editorial-ink group-hover:bg-editorial-ink group-hover:text-editorial-bg transition-all uppercase text-[10px] tracking-widest font-bold"
              >
                Review Full Report
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  const renderInterviewing = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row h-[calc(100vh-140px)]">
        <div className="w-full md:w-1/3 border-r border-editorial-ink p-10 flex flex-col justify-between">
          <div>
            <div className="mb-12">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-editorial-muted">Session Progress</span>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-8xl font-serif leading-none tracking-tighter-plus">{currentQuestionIndex + 1}</span>
                <span className="text-2xl font-serif text-editorial-muted">/ {questions.length}</span>
              </div>
            </div>
            
            <div className="space-y-8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Prompt Classification</p>
                <div className="inline-block px-3 py-1 border border-editorial-ink rounded-full text-[10px] uppercase tracking-[0.1em] font-extrabold">
                  {currentQuestion.type}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Instructions</p>
                <p className="text-xs leading-relaxed text-editorial-muted italic">Take your time. We are looking for depth, clarity, and specific evidence of your experience.</p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-editorial-ink opacity-40">
            <p className="text-[9px] uppercase tracking-[0.3em] font-bold">Interview Active / Monitoring</p>
          </div>
        </div>

        <div className="flex-1 p-10 flex flex-col">
          <motion.div 
            key={currentQuestionIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            <div className="mb-12">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted mb-4 opacity-50">Current Inquiry</p>
              <h2 className="text-4xl font-serif italic font-light leading-tight">
                "{currentQuestion.text}"
              </h2>
            </div>

            <div className="flex-1 flex flex-col gap-6">
              <div className="flex-1 relative">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Transcription Input</p>
                <textarea
                  ref={answerRef}
                  className="w-full h-full bg-white border border-editorial-ink p-8 text-lg font-serif italic outline-none resize-none focus:ring-0"
                  placeholder="Articulate your response here..."
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-4 border border-editorial-ink bg-red-50 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="bg-editorial-ink text-editorial-bg px-12 py-4 uppercase text-[11px] tracking-[0.2em] font-bold transition-all hover:bg-stone-800 disabled:opacity-30"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finalize Interview' : 'Submit Response'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedback) return null;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto py-12 px-10"
      >
        <header className="border-b border-editorial-ink py-10 flex flex-col md:flex-row justify-between items-baseline gap-4 mb-0">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Candidate Assessment / Session #042</span>
            <h1 className="text-6xl font-serif italic font-light mt-2 leading-none">Interview Performance Report</h1>
          </div>
          <div className="md:text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-editorial-muted">Role Target</p>
            <p className="text-2xl font-serif italic mt-1 tracking-tight">{role}</p>
          </div>
        </header>

        <div className="flex flex-col md:flex-row">
          {/* Left Column: Metrics & Summary */}
          <section className="w-full md:w-1/3 md:border-r border-editorial-ink p-10 flex flex-col justify-between pl-0">
            <div>
              <div className="mb-16">
                <p className="text-[11px] uppercase tracking-widest font-bold mb-6 opacity-50">Overall Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10rem] font-serif leading-none tracking-tighter-plus">{feedback.overallScore}</span>
                  <span className="text-4xl font-serif text-editorial-muted">/10</span>
                </div>
              </div>

              <div className="space-y-12">
                {recommendations.length > 0 && (
                   <div>
                    <p className="text-[11px] uppercase tracking-widest font-bold mb-4 flex items-center gap-2"><Target size={14} className="text-indigo-600" /> Strategic Opportunities</p>
                    <div className="space-y-4">
                      {recommendations.map((rec, i) => (
                        <div key={i} className="p-4 bg-white border border-editorial-ink relative">
                          <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[8px] px-2 py-0.5 font-black uppercase tracking-widest">{Math.round(rec.alignmentScore * 10)}% Match</span>
                          <p className="text-[10px] font-bold uppercase mb-1">{rec.company}</p>
                          <p className="text-sm font-serif italic leading-tight mb-2">{rec.role}</p>
                          <p className="text-[9px] text-editorial-muted leading-relaxed">{rec.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-bold mb-4">Improvement Roadmap</p>
                  <ul className="space-y-4">
                    {feedback.improvementActions.map((a, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <span className="text-lg font-serif italic border-b border-editorial-ink leading-none">{i + 1}</span>
                        <span className="text-[13px] font-medium leading-relaxed underline underline-offset-4">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-12 mt-12 border-t border-editorial-ink opacity-40">
              <p className="text-[9px] uppercase tracking-[0.3em] font-bold">AI Mock Interviewer v.2.4.0</p>
            </div>
          </section>

          {/* Right Column: Detail Sections */}
          <section className="flex-1 p-10 flex flex-col pr-0">
            {insights && (
               <div className="mb-16 p-8 border-2 border-editorial-ink bg-stone-50">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-6">
                    <Building size={14} /> Competitive Context: {company}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-4 opacity-50 italic">Corporate Focus</p>
                      <ul className="space-y-2">
                        {insights.focusAreas.map((f, i) => (
                          <li key={i} className="text-xs font-bold leading-relaxed flex items-center gap-2">
                            <div className="w-1 h-1 bg-editorial-ink rounded-full" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-4 opacity-50 italic">Cultural Thesis</p>
                      <p className="text-xs leading-relaxed text-editorial-muted italic">"{insights.companyCulture}"</p>
                    </div>
                  </div>
                  <div className="mt-8 pt-8 border-t border-stone-200">
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-4 opacity-50 italic">Historical Inquiry Samples</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.pastQuestions.map((q, i) => (
                          <div key={i} className="text-[11px] font-serif italic leading-snug border-l border-indigo-200 pl-4 py-1">
                            {q}
                          </div>
                        ))}
                    </div>
                  </div>
               </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 flex-1">
              {/* Strengths */}
              <div>
                <h3 className="text-[11px] uppercase tracking-widest font-bold mb-8 flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-600 rounded-full"></span> What You Did Well
                </h3>
                <ul className="space-y-8">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-50">Observation 0{i + 1}</p>
                      <p className="text-base font-serif italic text-editorial-ink leading-snug">{s}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div>
                <h3 className="text-[11px] uppercase tracking-widest font-bold mb-8 flex items-center gap-3">
                  <span className="w-2 h-2 bg-red-600 rounded-full"></span> Growth Opportunities
                </h3>
                <ul className="space-y-8">
                   {feedback.weaknesses.map((w, i) => (
                    <li key={i}>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-50">Critique 0{i+1}</p>
                      <p className="text-base font-serif italic text-editorial-ink leading-snug">{w}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pro Tips Section */}
            <div className="mt-16 pt-10 border-t border-editorial-ink">
               <h3 className="text-[11px] uppercase tracking-widest font-bold mb-6 flex items-center gap-3">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Expert Commentary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {feedback.proTips.map((tip, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-[10px] font-mono opacity-50 font-bold">[{i+1}]</span>
                      <p className="text-xs leading-relaxed text-editorial-muted">{tip}</p>
                    </div>
                  ))}
                </div>
            </div>

            {/* Highlight Section */}
            <div className="mt-16 pt-10 border-t border-editorial-ink">
              <p className="text-[10px] uppercase tracking-widest font-bold mb-6 opacity-50">Highlight of the Session</p>
              <blockquote className="text-4xl font-serif italic leading-tight text-editorial-ink mb-6 border-l-2 border-editorial-ink pl-8 py-2">
                "{feedback.bestAnswer.quote}"
              </blockquote>
              <div className="p-6 bg-stone-100/50 italic text-[13px] leading-relaxed flex items-start gap-4">
                 <p><span className="font-bold not-italic text-[10px] uppercase tracking-widest mr-2 opacity-50">Strategic Value /</span> {feedback.bestAnswer.reason}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-24 flex items-center justify-center gap-12">
            <button
              onClick={resetInterview}
              className="flex items-center gap-3 text-editorial-ink font-bold uppercase text-[11px] tracking-[0.3em] hover:opacity-60 transition-opacity"
            >
              <RefreshCcw size={18} /> Restart Session
            </button>
            <button
              onClick={() => window.print()}
              className="bg-editorial-ink text-editorial-bg px-10 py-3 uppercase text-[11px] tracking-[0.3em] font-bold hover:bg-stone-800 transition-all"
            >
              Export to PDF
            </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-editorial-bg selection:bg-editorial-ink selection:text-editorial-bg">
      <nav className="border-b border-editorial-ink px-10 py-6 sticky top-0 bg-editorial-bg/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-end">
          <div className="flex flex-col cursor-pointer group" onClick={resetInterview}>
            <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-editorial-muted group-hover:text-editorial-ink transition-colors">Strategic Hiring</span>
            <span className="text-2xl font-serif font-black tracking-tighter">QuickHire <span className="italic font-light">Laboratory</span></span>
          </div>
          <div className="hidden md:flex items-center gap-12 text-[10px] uppercase tracking-[0.2em] font-bold pb-1">
            <button onClick={() => setPhase(InterviewPhase.HISTORY)} className="hover:line-through transition-all">Archives</button>
            <a href="#" className="hover:line-through transition-all">Protocols</a>
            <div className="flex items-center gap-2 pl-6 border-l border-editorial-ink">
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>{user.displayName || user.email}</span>
                  </div>
                  <button onClick={() => signOut(auth)} className="opacity-50 hover:opacity-100"><LogOut size={14} /></button>
                </div>
              ) : (
                <button onClick={signInWithGoogle} className="hover:underline">Collaborator Login</button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="min-h-[calc(100vh-180px)]">
        <AnimatePresence mode="wait">
          {phase === InterviewPhase.WELCOME && renderWelcome()}
          {phase === InterviewPhase.COMPANY_SEARCH && renderCompanySearch()}
          {phase === InterviewPhase.LOADING_QUESTIONS && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-10 text-center">
              <div className="w-12 h-12 border-2 border-editorial-ink border-t-transparent animate-spin mb-8" />
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold mb-2">Initializing Interview Engine</span>
              <h2 className="text-4xl font-serif italic font-light">Curating high-stakes prompts for <br /> {role} {company && `at ${company}`}</h2>
            </div>
          )}
          {phase === InterviewPhase.INTERVIEWING && renderInterviewing()}
          {phase === InterviewPhase.GENERATING_FEEDBACK && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-10">
               <div className="w-16 h-1 bg-editorial-ink mb-12 animate-pulse" />
               <span className="text-[10px] uppercase tracking-[0.4em] font-bold mb-4">Neural Assessment in Progress</span>
               <h2 className="text-4xl font-serif italic font-light max-w-md">Distilling session metrics into an actionable performance roadmap.</h2>
            </div>
          )}
          {phase === InterviewPhase.FEEDBACK && renderFeedback()}
          {phase === InterviewPhase.HISTORY && renderHistory()}
        </AnimatePresence>
      </main>

      <footer className="bg-editorial-ink text-editorial-bg py-6 px-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-8">
          <div className="text-[9px] uppercase tracking-[0.2em]">
            <span className="opacity-50 mr-2">Assessor:</span> <span className="font-bold italic">AI Career Architect / Gemini-3</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em]">
            <span className="opacity-50 mr-2">Region:</span> <span className="font-bold tracking-tight">Global / Node-42</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em]">
            <span className="opacity-50 mr-2">Status:</span> <span className="font-bold underline">Validated</span>
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.3em] font-bold opacity-30">
          &copy; 2026 QUICKHIRE AI // BEYOND THE CV
        </div>
      </footer>
    </div>
  );
}
