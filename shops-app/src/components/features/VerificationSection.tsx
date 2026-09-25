"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import Webcam from 'react-webcam';
import {
    Camera, Upload, CheckCircle, XCircle, Shield, Loader2, Award,
    AlertCircle, RefreshCw, Image as ImageIcon, ChevronDown, FileText
} from 'lucide-react';
import { verificationsService } from '@/services/verifications';
import type { VerificationRequest } from '@/types';

const DOCUMENT_TYPE_KEYS = [
    { value: 'national_id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'refugee_id', label: 'Refugee ID' },
];

interface VerificationSectionProps {
    onClose?: () => void;
}

export const VerificationSection: React.FC<VerificationSectionProps> = ({ onClose }) => {
    const [selfieMode, setSelfieMode] = useState<'webcam' | 'upload'>('upload');
    const [selfieCapture, setSelfieCapture] = useState<string | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [documentFiles, setDocumentFiles] = useState<File[]>([]);
    const [documentType, setDocumentType] = useState('national_id');
    const [idNumber, setIdNumber] = useState('');
    const [tier, setTier] = useState<'tier2' | 'premium'>('tier2');
    const [proofOfAddressFile, setProofOfAddressFile] = useState<File | null>(null);
    const [videoSelfieFile, setVideoSelfieFile] = useState<File | null>(null);
    const [webcamError, setWebcamError] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [status, setStatus] = useState<VerificationRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const webcamRef = useRef<Webcam>(null);

    useEffect(() => {
        fetchVerificationStatus();
    }, []);

    const fetchVerificationStatus = async () => {
        try {
            setIsLoading(true);
            const data = await verificationsService.getMyVerificationStatus();
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch verification status:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const captureSelfie = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            setSelfieCapture(imageSrc);
        }
    }, []);

    const handleSelfieFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelfieFile(file);
        setSelfieCapture(URL.createObjectURL(file));
    };

    const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setDocumentFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async () => {
        if (!selfieCapture && !selfieFile) {
            setSubmitError('Please provide a selfie');
            return;
        }
        if (documentFiles.length === 0) {
            setSubmitError('Please upload at least one document');
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        try {
            setIsCompressing(true);

            let finalSelfieFile = selfieFile;
            if (selfieCapture && !selfieFile) {
                const res = await fetch(selfieCapture);
                const blob = await res.blob();
                finalSelfieFile = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
            }

            const docOptions = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false };
            const selfieOptions = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: false };

            const compressedDocs: File[] = [];
            for (const file of documentFiles) {
                const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
                if (isPdf) {
                    compressedDocs.push(file);
                } else {
                    const compressed = await imageCompression(file, docOptions);
                    compressedDocs.push(new File([compressed], file.name, { type: compressed.type || file.type }));
                }
            }

            let compressedSelfie: File | null = finalSelfieFile;
            if (finalSelfieFile) {
                compressedSelfie = await imageCompression(finalSelfieFile, selfieOptions);
            }

            let compressedAddress: File | undefined;
            if (proofOfAddressFile) {
                const isPdf = proofOfAddressFile.type === 'application/pdf' || proofOfAddressFile.name.endsWith('.pdf');
                if (isPdf) {
                    compressedAddress = proofOfAddressFile;
                } else {
                    compressedAddress = await imageCompression(proofOfAddressFile, docOptions);
                }
            }

            setIsCompressing(false);

            await verificationsService.submitVerificationRequest(
                documentType,
                idNumber,
                tier,
                compressedDocs,
                compressedSelfie!,
                compressedAddress,
                videoSelfieFile,
            );

            setSubmitSuccess(true);
            setSelfieCapture(null);
            setSelfieFile(null);
            setDocumentFiles([]);
            setProofOfAddressFile(null);
            setVideoSelfieFile(null);

            setTimeout(() => {
                fetchVerificationStatus();
                setSubmitSuccess(false);
            }, 2000);
        } catch (err: any) {
            const message = err?.response?.data?.detail || 'Failed to submit verification request';
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
            setIsCompressing(false);
        }
    };

    const canSubmit = (!!selfieCapture || !!selfieFile) && documentFiles.length > 0 && !isSubmitting && !isCompressing;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Banner */}
            {status && (
                <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${
                    status.status === 'approved'
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                        : status.status === 'pending'
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                    {status.status === 'approved' ? (
                        <>
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-900 dark:text-green-200">Account Verified</h3>
                                <p className="text-sm text-green-700 dark:text-green-300">Your account has been verified and you can now sell items</p>
                            </div>
                            <Shield className="w-8 h-8 text-green-500 dark:text-green-400 ml-auto shrink-0" />
                        </>
                    ) : status.status === 'pending' ? (
                        <>
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                            </div>
                            <div>
                                <h3 className="font-bold text-blue-900 dark:text-blue-200">Under Review</h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">Your verification request is being reviewed</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-red-900 dark:text-red-200">Verification Rejected</h3>
                                <p className="text-sm text-red-700 dark:text-red-300">Please submit a new verification request with correct documents</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Success Message */}
            {submitSuccess && (
                <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-200">Submission Successful</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">Your verification request has been submitted for review</p>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
            )}

            {/* Form — only show if not pending/approved */}
            {(!status || status.status === 'rejected') && !submitSuccess && (
                <>
                    {/* Tier Selection */}
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Verification Tier</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setTier('tier2')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                    tier === 'tier2'
                                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Shield className={`h-6 w-6 mb-2 ${tier === 'tier2' ? 'text-sky-500' : 'text-gray-400'}`} />
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Standard ID</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">ID + Selfie</p>
                            </button>
                            <button
                                onClick={() => setTier('premium')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                    tier === 'premium'
                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Award className={`h-6 w-6 mb-2 ${tier === 'premium' ? 'text-amber-500' : 'text-gray-400'}`} />
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Premium Badge</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Video + Address</p>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Document Type */}
                        <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Select Document Type</h3>
                            <div className="relative">
                                <select
                                    value={documentType}
                                    onChange={e => setDocumentType(e.target.value)}
                                    className="w-full appearance-none border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                >
                                    {DOCUMENT_TYPE_KEYS.map(dt => (
                                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* ID Number */}
                        <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">ID Number</h3>
                            <input
                                type="text"
                                value={idNumber}
                                onChange={e => setIdNumber(e.target.value)}
                                placeholder="Enter your ID or business registration number"
                                className="w-full border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            />
                        </div>

                        {/* Premium Tier Additional Fields */}
                        {tier === 'premium' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Proof of Address</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Upload a utility bill or bank statement showing your name and address.</p>
                                    <label className="block cursor-pointer">
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setProofOfAddressFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                                            proofOfAddressFile
                                                ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                                : 'border-gray-200 dark:border-neutral-800 hover:border-sky-300'
                                        }`}>
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload className={`h-6 w-6 ${proofOfAddressFile ? 'text-amber-500' : 'text-gray-400'}`} />
                                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                                    {proofOfAddressFile ? proofOfAddressFile.name : "Choose Address Document"}
                                                </span>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Video Selfie</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">A short 30-second video of yourself stating your name and holding your ID.</p>
                                    <label className="block cursor-pointer">
                                        <input
                                            type="file"
                                            accept="video/*"
                                            capture="user"
                                            onChange={(e) => setVideoSelfieFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                                            videoSelfieFile
                                                ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                                : 'border-gray-200 dark:border-neutral-800 hover:border-sky-300'
                                        }`}>
                                            <div className="flex flex-col items-center gap-2">
                                                <Camera className={`h-6 w-6 ${videoSelfieFile ? 'text-amber-500' : 'text-gray-400'}`} />
                                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                                    {videoSelfieFile ? videoSelfieFile.name : "Capture / Upload Video"}
                                                </span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Document Upload */}
                        <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Upload ID Document</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload both sides of your ID or passport</p>

                            <label className="block cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf"
                                    onChange={handleDocumentUpload}
                                    className="hidden"
                                />
                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                                    documentFiles.length > 0
                                        ? 'border-sky-300 bg-sky-50 dark:bg-sky-900/20'
                                        : 'border-gray-200 dark:border-neutral-800 hover:border-sky-300'
                                }`}>
                                    {documentFiles.length > 0 ? (
                                        <div className="space-y-2">
                                            <CheckCircle className="w-10 h-10 text-sky-500 mx-auto" />
                                            <p className="font-semibold text-sky-800 dark:text-sky-200">
                                                {documentFiles.length > 1 ? `${documentFiles.length} files selected` : '1 file selected'}
                                            </p>
                                            <ul className="text-xs text-sky-700 dark:text-sky-300 space-y-0.5">
                                                {documentFiles.map((f, i) => <li key={i}>{f.name}</li>)}
                                            </ul>
                                            <div className="grid grid-cols-2 gap-3 mt-4 max-w-md mx-auto">
                                                {documentFiles.map((file, i) => {
                                                    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
                                                    return (
                                                        <div key={i} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 aspect-[4/3] shadow-sm">
                                                            {isPdf ? (
                                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-neutral-950 text-gray-400 p-2">
                                                                    <FileText className="w-8 h-8 text-gray-400 mb-1" />
                                                                    <span className="text-[10px] font-bold truncate max-w-full px-1 text-gray-600 dark:text-gray-400">{file.name}</span>
                                                                </div>
                                                            ) : (
                                                                <img
                                                                    src={URL.createObjectURL(file)}
                                                                    alt={file.name}
                                                                    className="w-full h-full object-cover"
                                                                    onLoad={(e) => {
                                                                        try { URL.revokeObjectURL((e.target as HTMLImageElement).src); } catch (err) {}
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-sky-600 dark:text-sky-400 mt-2">Click to change</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                                            <p className="font-semibold text-gray-600 dark:text-gray-300">Click to upload</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">PNG, JPG or PDF</p>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>

                        {/* Selfie */}
                        <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-neutral-800">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Take a Selfie</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Hold your ID up to your face</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setSelfieMode('upload'); setSelfieCapture(null); setSelfieFile(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            selfieMode === 'upload'
                                                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900'
                                        }`}
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 inline mr-1" />Upload
                                    </button>
                                    <button
                                        onClick={() => { setSelfieMode('webcam'); setSelfieCapture(null); setSelfieFile(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            selfieMode === 'webcam'
                                                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900'
                                        }`}
                                    >
                                        <Camera className="w-3.5 h-3.5 inline mr-1" />Camera
                                    </button>
                                </div>
                            </div>

                            {selfieMode === 'upload' ? (
                                <label className="block cursor-pointer">
                                    <input type="file" accept="image/*" capture="user" onChange={handleSelfieFile} className="hidden" />
                                    <div className={`border-2 border-dashed rounded-xl transition-colors overflow-hidden ${
                                        selfieCapture ? 'border-sky-300' : 'border-gray-200 dark:border-neutral-800 hover:border-sky-300'
                                    }`}>
                                        {selfieCapture ? (
                                            <div className="relative">
                                                <img src={selfieCapture} alt="Selfie" className="w-full max-h-64 object-cover rounded-xl" />
                                                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center">
                                                    <CheckCircle className="w-5 h-5 text-white" />
                                                </div>
                                                <p className="text-center text-xs text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 py-2">Tap to retake</p>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center space-y-2">
                                                <Camera className="w-10 h-10 text-gray-400 mx-auto" />
                                                <p className="font-semibold text-gray-600 dark:text-gray-300">Click to upload or take photo</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">On mobile, camera will open</p>
                                            </div>
                                        )}
                                    </div>
                                </label>
                            ) : (
                                <div>
                                    <div className="rounded-xl overflow-hidden bg-gray-900 dark:bg-gray-950 mb-3 max-h-72">
                                        {selfieCapture ? (
                                            <img src={selfieCapture} alt="Selfie" className="w-full object-cover" />
                                        ) : webcamError ? (
                                            <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
                                                <AlertCircle className="w-8 h-8" />
                                                <p className="text-sm">Camera not available</p>
                                                <button
                                                    onClick={() => { setSelfieMode('upload'); setWebcamError(false); }}
                                                    className="text-xs text-sky-400 underline"
                                                >Switch to upload</button>
                                            </div>
                                        ) : (
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                className="w-full"
                                                videoConstraints={{ facingMode: 'user' }}
                                                onUserMediaError={() => setWebcamError(true)}
                                            />
                                        )}
                                    </div>
                                    {selfieCapture ? (
                                        <button
                                            onClick={() => setSelfieCapture(null)}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" />Retake
                                        </button>
                                    ) : !webcamError && (
                                        <button
                                            onClick={captureSelfie}
                                            className="w-full px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Camera className="w-4 h-4" />Capture Photo
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className={`w-full px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                                canSubmit
                                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                                    : 'bg-gray-200 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isCompressing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Compressing images…</>
                            ) : isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                            ) : (
                                <><Shield className="w-4 h-4" />Submit Verification</>
                            )}
                        </button>
                    </div>
                </>
            )}

            {/* Info Banner */}
            <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-3">Why Verify?</h4>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                    <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>Build trust with buyers and sellers</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>Unlock the ability to list items for sale</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>Access premium features</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>Get a verified badge on your profile</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};
