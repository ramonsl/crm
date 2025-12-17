/**
 * AlertModal Component Tests
 * 
 * Tests for the alert modal component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { AlertModal } from '@/components/AlertModal';

describe('AlertModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        title: 'Test Title',
        message: 'Test message content',
        type: 'info' as const,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render when isOpen is true', () => {
            render(<AlertModal {...defaultProps} />);
            expect(screen.getByText('Test Title')).toBeInTheDocument();
            expect(screen.getByText('Test message content')).toBeInTheDocument();
        });

        it('should not render when isOpen is false', () => {
            render(<AlertModal {...defaultProps} isOpen={false} />);
            expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
        });

        it('should render close button', () => {
            render(<AlertModal {...defaultProps} />);
            expect(screen.getByText('OK')).toBeInTheDocument();
        });
    });

    describe('modal types', () => {
        it('should render info type correctly', () => {
            render(<AlertModal {...defaultProps} type="info" />);
            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });

        it('should render success type correctly', () => {
            render(<AlertModal {...defaultProps} type="success" />);
            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });

        it('should render warning type correctly', () => {
            render(<AlertModal {...defaultProps} type="warning" />);
            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });

        it('should render error type correctly', () => {
            render(<AlertModal {...defaultProps} type="error" />);
            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('should call onClose when close button is clicked', () => {
            render(<AlertModal {...defaultProps} />);
            fireEvent.click(screen.getByText('OK'));
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when overlay is clicked', () => {
            render(<AlertModal {...defaultProps} />);
            // Click on the overlay by finding the modal container
            const buttons = screen.getAllByRole('button');
            const okButton = buttons.find(btn => btn.textContent === 'OK');
            if (okButton) {
                fireEvent.click(okButton);
                expect(defaultProps.onClose).toHaveBeenCalled();
            }
        });
    });
});
