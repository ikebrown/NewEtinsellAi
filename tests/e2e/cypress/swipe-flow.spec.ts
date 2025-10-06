
describe('Swipe Flow', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/discover');
  });

  it('should display profile cards', () => {
    cy.get('[data-testid="profile-card"]').should('be.visible');
  });

  it('should swipe right and match', () => {
    cy.get('[data-testid="like-button"]').click();
    cy.get('[data-testid="match-modal"]').should('be.visible');
  });

  it('should swipe left to pass', () => {
    cy.get('[data-testid="pass-button"]').click();
    cy.get('[data-testid="profile-card"]').should('not.contain', 'John');
  });
});